import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.MIGRATE_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Does a locations table exist, and what are its columns?
    const { rows: locationColumns } = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'locations'
      ORDER BY ordinal_position;
    `;

    // Sample the locations rows (the real warehouses, if any).
    let locationSample: Record<string, unknown>[] = [];
    try {
      const r = await sql`SELECT * FROM locations LIMIT 20;`;
      locationSample = r.rows;
    } catch {
      locationSample = [];
    }

    // Does a companies table exist? (locations usually belong to a company)
    let companySample: Record<string, unknown>[] = [];
    try {
      const r = await sql`SELECT * FROM companies LIMIT 20;`;
      companySample = r.rows;
    } catch {
      companySample = [];
    }

    // Batteries: how many have a location set vs null, grouped by location + status.
    const { rows: batteryLocationBreakdown } = await sql`
      SELECT
        b.location_id,
        b.status::text AS status,
        COUNT(*)::int AS count
      FROM batteries b
      GROUP BY b.location_id, b.status
      ORDER BY b.location_id NULLS FIRST, b.status;
    `;

    // Batteries: count by battery_model code (group size lives here: 24F, 34, 35, 48...).
    const { rows: batteryByModelCode } = await sql`
      SELECT
        bm.code AS model_code,
        bt.name AS type_name,
        COUNT(*)::int AS count
      FROM batteries b
      LEFT JOIN battery_models bm ON bm.id = b.battery_model_id
      LEFT JOIN battery_types bt ON bt.id = b.battery_type_id
      GROUP BY bm.code, bt.name
      ORDER BY bm.code NULLS FIRST;
    `;

    // Trucks table columns + sample (for the owner-side assign-to-truck tool).
    const { rows: truckColumns } = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'trucks'
      ORDER BY ordinal_position;
    `;
    let truckSample: Record<string, unknown>[] = [];
    try {
      const r = await sql`SELECT * FROM trucks LIMIT 20;`;
      truckSample = r.rows;
    } catch {
      truckSample = [];
    }

    return NextResponse.json({
      ok: true,
      locationColumns,
      locationSample,
      companySample,
      batteryLocationBreakdown,
      batteryByModelCode,
      truckColumns,
      truckSample,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
