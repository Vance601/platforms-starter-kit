import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.MIGRATE_SECRET) {
    return NextResponse.json(
      { error: "Unauthorized. Add ?secret=YOUR_MIGRATE_SECRET to the URL." },
      { status: 401 }
    );
  }

  try {
    // The valid values of the battery_status enum — THE thing I need for Phase 4
    const { rows: statusEnum } = await sql`
      SELECT e.enumlabel AS value, e.enumsortorder AS sort_order
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = 'battery_status'
      ORDER BY e.enumsortorder;
    `;

    // Full column list for battery_movements
    const { rows: movementCols } = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'battery_movements'
      ORDER BY ordinal_position;
    `;

    // Count batteries by status so I know what state the data is actually in
    const { rows: statusCounts } = await sql`
      SELECT status::text AS status, COUNT(*)::int AS count
      FROM batteries
      GROUP BY status
      ORDER BY status;
    `;

    // A few full sample battery rows
    const { rows: sampleBatteries } = await sql`
      SELECT id, barcode, company_id, location_id, truck_id,
             current_truck_id, current_driver_id, status
      FROM batteries
      LIMIT 5;
    `;

    // Trucks, so I can confirm how a driver picks one and what id format looks like
    const { rows: sampleTrucks } = await sql`
      SELECT id, truck_number, company_id, current_driver_id, active
      FROM trucks
      ORDER BY truck_number
      LIMIT 20;
    `;

    return NextResponse.json({
      success: true,
      battery_status_enum: statusEnum,
      battery_movements_columns: movementCols,
      battery_status_counts: statusCounts,
      sample_batteries: sampleBatteries,
      sample_trucks: sampleTrucks,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
