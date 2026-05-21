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

  const results: string[] = [];

  try {
    // ============================================================
    // STEP 1 — Add truck_id column to batteries (nullable)
    // A battery is at a warehouse (truck_id NULL) OR on a truck.
    // Non-destructive: existing batteries keep truck_id = NULL.
    // ============================================================
    await sql`
      ALTER TABLE batteries
      ADD COLUMN IF NOT EXISTS truck_id TEXT REFERENCES trucks(id);
    `;
    results.push("Added truck_id column to batteries");

    await sql`
      CREATE INDEX IF NOT EXISTS idx_batteries_truck ON batteries(truck_id);
    `;
    results.push("Created index on batteries.truck_id");

    // ============================================================
    // STEP 2 — Extend battery_movements for truck transfers
    // Add columns to log driver + truck + call reference on moves
    // ============================================================
    await sql`
      ALTER TABLE battery_movements
      ADD COLUMN IF NOT EXISTS from_truck_id TEXT REFERENCES trucks(id);
    `;
    results.push("Added from_truck_id to battery_movements");

    await sql`
      ALTER TABLE battery_movements
      ADD COLUMN IF NOT EXISTS to_truck_id TEXT REFERENCES trucks(id);
    `;
    results.push("Added to_truck_id to battery_movements");

    await sql`
      ALTER TABLE battery_movements
      ADD COLUMN IF NOT EXISTS driver_id TEXT REFERENCES drivers(id);
    `;
    results.push("Added driver_id to battery_movements");

    await sql`
      ALTER TABLE battery_movements
      ADD COLUMN IF NOT EXISTS call_reference TEXT;
    `;
    results.push("Added call_reference to battery_movements");

    // ============================================================
    // STEP 3 — Verification snapshot
    // ============================================================
    const { rows: batteryCols } = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'batteries' AND column_name = 'truck_id';
    `;
    results.push(`batteries.truck_id exists: ${batteryCols.length > 0}`);

    const { rows: movementCols } = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'battery_movements'
        AND column_name IN ('from_truck_id', 'to_truck_id', 'driver_id', 'call_reference')
      ORDER BY column_name;
    `;
    results.push(`battery_movements new columns: ${movementCols.map(c => c.column_name).join(", ")}`);

    const { rows: batteryCount } = await sql`
      SELECT COUNT(*)::int AS count FROM batteries;
    `;
    results.push(`Existing batteries preserved: ${batteryCount[0].count}`);

    const { rows: onTruck } = await sql`
      SELECT COUNT(*)::int AS count FROM batteries WHERE truck_id IS NOT NULL;
    `;
    results.push(`Batteries currently on trucks: ${onTruck[0].count}`);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        completedSteps: results,
      },
      { status: 500 }
    );
  }
}
