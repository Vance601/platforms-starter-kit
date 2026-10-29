import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";
import { generateNextBarcode } from "@/lib/barcode";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "owner" && user.role !== "manager") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (!user.orgId) {
    // Fail-closed: no tenant context returns empty rather than leaking all orgs.
    return NextResponse.json({ batteries: [], byLocation: [], byClassification: [] });
  }

  try {
    const { rows: batteries } = await sql`
      SELECT
        batteries.id,
        batteries.barcode,
        batteries.status,
        batteries.cost,
        batteries.received_at,
        battery_types.code AS classification_code,
        battery_models.code AS model_code,
        battery_models.display_name AS model_display,
        locations.name AS location_name,
        locations.slug AS location_slug,
        companies.name AS company_name,
        companies.slug AS company_slug,
        batteries.truck_id,
        trucks.truck_number,
        drivers.name AS truck_driver_name,
        mbs_invoices.invoice_number AS source_invoice
      FROM batteries
      JOIN battery_types ON battery_types.id = batteries.battery_type_id
      LEFT JOIN battery_models ON battery_models.id = batteries.battery_model_id
      JOIN locations ON locations.id = batteries.location_id
      JOIN companies ON companies.id = batteries.company_id
      LEFT JOIN trucks ON trucks.id = batteries.truck_id
      LEFT JOIN drivers ON drivers.id = trucks.current_driver_id
      LEFT JOIN mbs_invoices ON mbs_invoices.id = batteries.mbs_invoice_id
      WHERE companies.org_id = ${user.orgId}
      ORDER BY batteries.received_at DESC, batteries.created_at DESC;
    `;

    const { rows: byLocation } = await sql`
      SELECT
        locations.id,
        locations.name AS location_name,
        locations.slug AS location_slug,
        companies.name AS company_name,
        COUNT(batteries.id)::int AS count
      FROM locations
      JOIN companies ON companies.id = locations.company_id
      LEFT JOIN batteries ON batteries.location_id = locations.id
        AND batteries.status = 'in_warehouse'
      WHERE locations.active = TRUE
        AND companies.org_id = ${user.orgId}
      GROUP BY locations.id, locations.name, locations.slug, companies.name
      ORDER BY companies.name, locations.name;
    `;

    const { rows: byClassification } = await sql`
      SELECT
        battery_types.code AS classification,
        COUNT(batteries.id)::int AS count
      FROM battery_types
      LEFT JOIN batteries ON batteries.battery_type_id = battery_types.id
        AND batteries.status = 'in_warehouse'
        AND batteries.company_id IN (
          SELECT id FROM companies WHERE org_id = ${user.orgId}
        )
      GROUP BY battery_types.code
      ORDER BY battery_types.code;
    `;

    // Stock sitting ON trucks. The location cards only count in_warehouse, so
    // without this the on_truck units are invisible in the buckets even though
    // they appear in the table - the counts never added up to the total.
    const { rows: byTruck } = await sql`
      SELECT
        trucks.id,
        trucks.truck_number,
        drivers.name AS driver_name,
        companies.name AS company_name,
        COUNT(batteries.id)::int AS count
      FROM trucks
      JOIN companies ON companies.id = trucks.company_id
      LEFT JOIN drivers ON drivers.id = trucks.current_driver_id
      LEFT JOIN batteries ON batteries.truck_id = trucks.id
        AND batteries.status = 'on_truck'
      WHERE trucks.active = TRUE
        AND companies.org_id = ${user.orgId}
      GROUP BY trucks.id, trucks.truck_number, drivers.name, companies.name
      ORDER BY trucks.truck_number;
    `;

    // Totals so the page can show where every unit actually is.
    const { rows: statusRows } = await sql`
      SELECT batteries.status, COUNT(*)::int AS count
      FROM batteries
      JOIN companies ON companies.id = batteries.company_id
      WHERE companies.org_id = ${user.orgId}
      GROUP BY batteries.status;
    `;

    return NextResponse.json({
      batteries: batteries.map(b => ({
        id: b.id,
        barcode: b.barcode,
        status: b.status,
        cost: b.cost,
        receivedAt: b.received_at,
        classification: b.classification_code,
        model: b.model_code,
        modelDisplay: b.model_display,
        locationName: b.location_name,
        locationSlug: b.location_slug,
        companyName: b.company_name,
        companySlug: b.company_slug,
        truckId: b.truck_id,
        truckNumber: b.truck_number,
        truckDriverName: b.truck_driver_name,
        sourceInvoice: b.source_invoice,
      })),
      byLocation: byLocation.map(l => ({
        id: l.id,
        locationName: l.location_name,
        locationSlug: l.location_slug,
        companyName: l.company_name,
        count: l.count,
      })),
      byClassification: byClassification.map(c => ({
        classification: c.classification,
        count: c.count,
      })),
      byTruck: byTruck.map(t => ({
        id: t.id,
        truckNumber: t.truck_number,
        driverName: t.driver_name,
        companyName: t.company_name,
        count: t.count,
      })),
      byStatus: statusRows.map(r => ({ status: r.status, count: r.count })),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Manually add a single battery (the /batteries/new form). Mirrors the
// receive-order "addBattery" insert so barcodes, cost and the movement log
// stay identical to stock received on an invoice.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "owner" && user.role !== "manager") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (!user.orgId) {
    return NextResponse.json({ error: "No organization context" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { locationId, batteryModelCode, serialNumber, cost, notes } = body ?? {};
    if (!locationId || !batteryModelCode) {
      return NextResponse.json(
        { error: "Missing required fields: locationId, batteryModelCode" },
        { status: 400 }
      );
    }

    // Tenant guard: location must belong to the caller's org.
    const { rows: locs } = await sql`
      SELECT l.id, l.company_id, c.slug AS company_slug
      FROM locations l
      JOIN companies c ON c.id = l.company_id
      WHERE l.id = ${locationId} AND c.org_id = ${user.orgId};
    `;
    if (locs.length === 0) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }
    const loc = locs[0];

    const { rows: models } = await sql`
      SELECT battery_models.id AS model_id,
             battery_models.default_cost AS model_cost,
             battery_types.id AS type_id,
             battery_types.default_cost AS type_cost
      FROM battery_models
      JOIN battery_types ON battery_types.id = battery_models.battery_type_id
      WHERE battery_models.code = ${batteryModelCode};
    `;
    if (models.length === 0) {
      return NextResponse.json({ error: "Battery model not found" }, { status: 404 });
    }
    const model = models[0];
    const parsedCost =
      cost !== undefined && cost !== null && cost !== "" && !isNaN(Number(cost))
        ? Number(cost)
        : null;
    const finalCost = parsedCost ?? model.model_cost ?? model.type_cost ?? 0;

    const barcode = await generateNextBarcode(loc.company_slug, batteryModelCode);
    const batteryId = crypto.randomUUID();
    const serial = serialNumber ? String(serialNumber) : null;
    const noteText = notes ? String(notes) : null;

    await sql`
      INSERT INTO batteries
        (id, barcode, serial_number, battery_type_id, battery_model_id, company_id,
         location_id, status, cost, notes, received_at, created_at)
      VALUES
        (${batteryId}, ${barcode}, ${serial}, ${model.type_id}, ${model.model_id},
         ${loc.company_id}, ${loc.id}, 'in_warehouse', ${finalCost}, ${noteText},
         NOW(), NOW());
    `;

    await sql`
      INSERT INTO battery_movements
        (id, battery_id, from_status, to_status, to_location_id,
         occurred_at, recorded_by_id, notes)
      VALUES
        (${crypto.randomUUID()}, ${batteryId}, NULL, 'in_warehouse',
         ${loc.id}, NOW(), ${user.userId}, 'Added manually via Add Battery');
    `;

    return NextResponse.json({ success: true, batteryId, barcode });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
