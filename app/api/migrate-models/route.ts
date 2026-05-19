import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    // STEP 1 — Update battery_types
    //   - Rename AMG → AGM (real industry term)
    //   - Remove Charlie (not used)
    //   - Add Tesla and Prius as new classifications
    // ============================================================

    await sql`UPDATE battery_types SET code = 'AGM' WHERE code = 'AMG';`;
    results.push("Renamed AMG to AGM");

    // Only delete Charlie if no batteries reference it (safe guard)
    const { rows: charlieRefs } = await sql`
      SELECT COUNT(*)::int AS count FROM batteries
      WHERE battery_type_id = (SELECT id FROM battery_types WHERE code = 'Charlie');
    `;
    if (charlieRefs[0].count === 0) {
      await sql`DELETE FROM battery_types WHERE code = 'Charlie';`;
      results.push("Removed unused Charlie classification");
    } else {
      results.push(`Skipped Charlie removal: ${charlieRefs[0].count} batteries still reference it`);
    }

    // Insert Tesla and Prius if missing (idempotent)
    await sql`
      INSERT INTO battery_types (id, code, name, description, default_cost, default_price, par_level_min, par_level_max)
      VALUES (gen_random_uuid(), 'Tesla', 'Tesla', 'Tesla 12V auxiliary battery', 0, 0, 0, 0)
      ON CONFLICT (code) DO NOTHING;
    `;
    results.push("Ensured Tesla classification exists");

    
    await sql`
      INSERT INTO battery_types (id, code, name, description, default_cost, default_price, par_level_min, par_level_max)
      VALUES (gen_random_uuid(), 'Prius', 'Prius', 'Prius 12V battery', 0, 0, 0, 0)
      ON CONFLICT (code) DO NOTHING;
    `;
    results.push("Ensured Prius classification exists");
    // ============================================================
    // STEP 2 — Create battery_models table
    // ============================================================

    await sql`
      CREATE TABLE IF NOT EXISTS battery_models (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        battery_type_id UUID NOT NULL REFERENCES battery_types(id),
        default_cost NUMERIC(10, 2),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    results.push("Created battery_models table");

    await sql`CREATE INDEX IF NOT EXISTS idx_battery_models_type ON battery_models(battery_type_id);`;
    results.push("Created index on battery_models.battery_type_id");

    // ============================================================
    // STEP 3 — Add battery_model_id column to batteries table
    //   - Nullable initially (we'll delete the existing test battery
    //     before making it NOT NULL)
    // ============================================================

    await sql`
      ALTER TABLE batteries
      ADD COLUMN IF NOT EXISTS battery_model_id UUID REFERENCES battery_models(id);
    `;
    results.push("Added battery_model_id column to batteries");

    // ============================================================
    // STEP 4 — Seed all 22 battery_models
    //   Format: code (barcode-safe UPPER), display_name (human), classification
    // ============================================================

    const models: Array<[string, string, string]> = [
      // Alpha (11 models)
      ["24F", "24f", "Alpha"],
      ["34", "34", "Alpha"],
      ["35", "35", "Alpha"],
      ["47", "47", "Alpha"],
      ["48", "48", "Alpha"],
      ["51", "51", "Alpha"],
      ["51R", "51r", "Alpha"],
      ["65", "65", "Alpha"],
      ["78", "78", "Alpha"],
      ["140R", "140r", "Alpha"],
      ["AUX14", "aux14", "Alpha"],
      // Bravo (5 models)
      ["49", "49", "Bravo"],
      ["86", "86", "Bravo"],
      ["96R", "96r", "Bravo"],
      ["124R", "124r", "Bravo"],
      ["151R", "151r", "Bravo"],
      // AGM (4 models)
      ["47AGM", "47AGM", "AGM"],
      ["48AGM", "48AGM", "AGM"],
      ["49AGM", "49AGM", "AGM"],
      ["94RAGM", "94rAGM", "AGM"],
      // Tesla (1 model)
      ["TESLA", "Tesla 12V Aux", "Tesla"],
      // Prius (1 model)
      ["PRIUS", "Prius 12V", "Prius"],
    ];

    let inserted = 0;
    for (const [code, displayName, typeCode] of models) {
      await sql`
        INSERT INTO battery_models (code, display_name, battery_type_id)
        SELECT ${code}, ${displayName}, battery_types.id
        FROM battery_types
        WHERE battery_types.code = ${typeCode}
        ON CONFLICT (code) DO NOTHING;
      `;
      inserted++;
    }
    results.push(`Seeded ${inserted} battery models (22 expected)`);

    // ============================================================
    // STEP 5 — Delete the test battery and its movements
    //   - Hardcoded ID from the receive-order test earlier today
    // ============================================================

    const testBatteryId = "6963b2cd-d67e-47a6-81a1-0996f69de431";

    const { rows: testBatteryCheck } = await sql`
      SELECT id FROM batteries WHERE id = ${testBatteryId};
    `;
    if (testBatteryCheck.length > 0) {
      await sql`DELETE FROM battery_movements WHERE battery_id = ${testBatteryId};`;
      await sql`DELETE FROM batteries WHERE id = ${testBatteryId};`;
      results.push(`Deleted test battery ${testBatteryId} and its movements`);
    } else {
      results.push("No test battery found to delete (already removed)");
    }

    // ============================================================
    // STEP 6 — Also delete the test invoices MBS-TEST-001 + MBS-TEST-002
    //   - These were test invoices from today, clean them up
    // ============================================================

    const { rowCount: deletedInvoices } = await sql`
      DELETE FROM mbs_invoices
      WHERE invoice_number IN ('MBS-TEST-001', 'MBS-TEST-002');
    `;
    results.push(`Deleted ${deletedInvoices ?? 0} test invoice(s)`);

    // ============================================================
    // STEP 7 — Verification snapshot of final state
    // ============================================================

    const { rows: typeCounts } = await sql`
      SELECT code FROM battery_types ORDER BY code;
    `;
    results.push(`Final battery_types: ${typeCounts.map(t => t.code).join(", ")}`);

    const { rows: modelCounts } = await sql`
      SELECT battery_types.code AS classification, COUNT(*)::int AS model_count
      FROM battery_models
      JOIN battery_types ON battery_types.id = battery_models.battery_type_id
      GROUP BY battery_types.code
      ORDER BY battery_types.code;
    `;
    results.push(`Models per classification: ${modelCounts.map(m => `${m.classification}=${m.model_count}`).join(", ")}`);

    const { rows: batteryCount } = await sql`SELECT COUNT(*)::int AS count FROM batteries;`;
    results.push(`Final batteries count: ${batteryCount[0].count}`);

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
