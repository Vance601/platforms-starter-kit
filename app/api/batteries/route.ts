import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";

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
