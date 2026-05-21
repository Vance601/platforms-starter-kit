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
    // STEP 1 — Create truck_shifts table (audit history)
    // One row per driver-truck shift. ended_at NULL = active.
    // ============================================================
    await sql`
      CREATE TABLE IF NOT EXISTS truck_shifts (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        truck_id TEXT NOT NULL REFERENCES trucks(id),
        driver_id TEXT NOT NULL REFERENCES drivers(id),
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ended_at TIMESTAMP,
        batteries_at_start INT NOT NULL DEFAULT 0,
        auto_ended BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    results.push("Created truck_shifts table");

    await sql`
      CREATE INDEX IF NOT EXISTS idx_shifts_truck ON truck_shifts(truck_id);
    `;
    results.push("Created index on truck_shifts.truck_id");

    await sql`
      CREATE INDEX IF NOT EXISTS idx_shifts_driver ON truck_shifts(driver_id);
    `;
    results.push("Created index on truck_shifts.driver_id");

    await sql`
      CREATE INDEX IF NOT EXISTS idx_shifts_active ON truck_shifts(truck_id) WHERE ended_at IS NULL;
    `;
    results.push("Created partial index for active shifts");

    // ============================================================
    // STEP 2 — Verification snapshot
    // ============================================================
    const { rows: cols } = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'truck_shifts'
      ORDER BY ordinal_position;
    `;
    results.push(`truck_shifts columns: ${cols.map(c => c.column_name).join(", ")}`);

    const { rows: total } = await sql`
      SELECT COUNT(*)::int AS count FROM truck_shifts;
    `;
    results.push(`Total shifts logged: ${total[0].count}`);

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
