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
    // STEP 1 — is_warranty flag on batteries (default false).
    // Non-destructive: existing batteries become is_warranty = false.
    // ============================================================
    await sql`
      ALTER TABLE batteries
      ADD COLUMN IF NOT EXISTS is_warranty BOOLEAN NOT NULL DEFAULT false;
    `;
    results.push("Added is_warranty column to batteries (default false).");

    // ============================================================
    // STEP 2 — warranty_replaces_battery_id: FK to the failed battery.
    // Nullable. Self-referencing FK to batteries(id).
    // ============================================================
    await sql`
      ALTER TABLE batteries
      ADD COLUMN IF NOT EXISTS warranty_replaces_battery_id TEXT
        REFERENCES batteries(id);
    `;
    results.push("Added warranty_replaces_battery_id column (FK -> batteries.id).");

    // ============================================================
    // STEP 3 — warranty_note: free text for the 'other / not in system' case.
    // ============================================================
    await sql`
      ALTER TABLE batteries
      ADD COLUMN IF NOT EXISTS warranty_note TEXT;
    `;
    results.push("Added warranty_note column to batteries.");

    // ============================================================
    // Verify: confirm the three new columns now exist.
    // ============================================================
    const { rows: newCols } = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'batteries'
        AND column_name IN ('is_warranty', 'warranty_replaces_battery_id', 'warranty_note')
      ORDER BY column_name;
    `;
    results.push(`Confirmed new columns: ${newCols.map((c) => c.column_name).join(", ")}`);

    // Existing batteries are untouched.
    const { rows: batteryCount } = await sql`
      SELECT COUNT(*)::int AS count FROM batteries;
    `;
    results.push(`Existing batteries preserved: ${batteryCount[0].count}`);

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
