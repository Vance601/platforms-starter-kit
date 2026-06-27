import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isSignedIn } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const signedIn = await isSignedIn();
  if (!signedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        mbs_invoices.invoice_number AS source_invoice
      FROM batteries
      JOIN battery_types ON battery_types.id = batteries.battery_type_id
      LEFT JOIN battery_models ON battery_models.id = batteries.battery_model_id
      JOIN locations ON locations.id = batteries.location_id
      JOIN companies ON companies.id = batteries.company_id
      LEFT JOIN mbs_invoices ON mbs_invoices.id = batteries.mbs_invoice_id
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
      GROUP BY battery_types.code
      ORDER BY battery_types.code;
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
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
