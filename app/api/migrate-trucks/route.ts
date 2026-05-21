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
    // STEP 1 — Create trucks table
    // ============================================================
    await sql`
      CREATE TABLE IF NOT EXISTS trucks (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        truck_number TEXT NOT NULL,
        company_id TEXT REFERENCES companies(id),
        current_driver_id TEXT REFERENCES drivers(id),
        capacity INT NOT NULL DEFAULT 20,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    results.push("Created trucks table");

    await sql`
      CREATE INDEX IF NOT EXISTS idx_trucks_company ON trucks(company_id);
    `;
    results.push("Created index on trucks.company_id");

    await sql`
      CREATE INDEX IF NOT EXISTS idx_trucks_driver ON trucks(current_driver_id);
    `;
    results.push("Created index on trucks.current_driver_id");

    await sql`
      CREATE INDEX IF NOT EXISTS idx_trucks_active ON trucks(active);
    `;
    results.push("Created index on trucks.active");

    // ============================================================
    // STEP 2 — Look up the PHX company id
    // ============================================================
    const { rows: phxRows } = await sql`
      SELECT id FROM companies WHERE slug = 'phx';
    `;
    if (phxRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "PHX company not found (slug = 'phx')" },
        { status: 500 }
      );
    }
    const phxCompanyId = phxRows[0].id;
    results.push(`Found PHX company id: ${phxCompanyId}`);

    // ============================================================
    // STEP 3 — Seed 3 test trucks (no driver assigned yet)
    // ============================================================
    const truckNumbers = ["128", "129", "130"];

    let seeded = 0;
    let skipped = 0;
    for (const num of truckNumbers) {
      const { rows: existing } = await sql`
        SELECT id FROM trucks WHERE truck_number = ${num} AND company_id = ${phxCompanyId};
      `;
      if (existing.length > 0) {
        skipped++;
        continue;
      }
      await sql`
        INSERT INTO trucks (truck_number, company_id, current_driver_id, capacity, active)
        VALUES (${num}, ${phxCompanyId}, NULL, 20, TRUE);
      `;
      seeded++;
    }
    results.push(`Seeded ${seeded} test trucks (skipped ${skipped} already present)`);

    // ============================================================
    // STEP 4 — Verification snapshot
    // ============================================================
    const { rows: truckList } = await sql`
      SELECT trucks.truck_number, trucks.capacity, companies.slug AS company
      FROM trucks
      JOIN companies ON companies.id = trucks.company_id
      WHERE trucks.active = TRUE
      ORDER BY trucks.truck_number;
    `;
    results.push(`Active trucks now: ${truckList.map(t => `#${t.truck_number} (cap ${t.capacity})`).join(", ")}`);

    const { rows: total } = await sql`
      SELECT COUNT(*)::int AS count FROM trucks;
    `;
    results.push(`Total trucks count: ${total[0].count}`);

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
