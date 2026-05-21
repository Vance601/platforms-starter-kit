import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { randomBytes, scryptSync } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

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
    // STEP 1 — Create drivers table
    // ============================================================
    await sql`
      CREATE TABLE IF NOT EXISTS drivers (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        company_id TEXT REFERENCES companies(id),
        pin_hash TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    results.push("Created drivers table");

    await sql`
      CREATE INDEX IF NOT EXISTS idx_drivers_company ON drivers(company_id);
    `;
    results.push("Created index on drivers.company_id");

    await sql`
      CREATE INDEX IF NOT EXISTS idx_drivers_active ON drivers(active);
    `;
    results.push("Created index on drivers.active");

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
    // STEP 3 — Seed 13 PHX drivers with placeholder PIN 0000
    // ============================================================
    const driverNames = [
      "Curtis Reed",
      "Russell Ford",
      "Jeffrey Smith",
      "Travis Early",
      "Juan Vazquez",
      "Jody Tieman",
      "Joel Selvey",
      "Angelo Gumbel",
      "Arin Imler",
      "Antwoin White",
      "Naria Hampton",
      "Tyler Leonor",
      "Jesse Valenzuela",
    ];

    let seeded = 0;
    let skipped = 0;
    for (const name of driverNames) {
      const { rows: existing } = await sql`
        SELECT id FROM drivers WHERE name = ${name} AND company_id = ${phxCompanyId};
      `;
      if (existing.length > 0) {
        skipped++;
        continue;
      }
      const pinHash = hashPin("0000");
      await sql`
        INSERT INTO drivers (name, company_id, pin_hash, active)
        VALUES (${name}, ${phxCompanyId}, ${pinHash}, TRUE);
      `;
      seeded++;
    }
    results.push(`Seeded ${seeded} PHX drivers (skipped ${skipped} already present)`);

    // ============================================================
    // STEP 4 — Verification snapshot
    // ============================================================
    const { rows: driverList } = await sql`
      SELECT drivers.name, companies.slug AS company
      FROM drivers
      JOIN companies ON companies.id = drivers.company_id
      WHERE drivers.active = TRUE
      ORDER BY drivers.name;
    `;
    results.push(`Active drivers now: ${driverList.map(d => d.name).join(", ")}`);

    const { rows: total } = await sql`
      SELECT COUNT(*)::int AS count FROM drivers;
    `;
    results.push(`Total drivers count: ${total[0].count}`);

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
