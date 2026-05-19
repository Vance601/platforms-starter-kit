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
    // Add Group 27 model under Bravo classification
    // ============================================================

    const { rows: bravoCheck } = await sql`
      SELECT id FROM battery_types WHERE code = 'Bravo';
    `;
    if (bravoCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: "Bravo classification not found in battery_types" },
        { status: 500 }
      );
    }

    await sql`
      INSERT INTO battery_models (code, display_name, battery_type_id)
      SELECT '27', '27', battery_types.id
      FROM battery_types
      WHERE battery_types.code = 'Bravo'
      ON CONFLICT (code) DO NOTHING;
    `;
    results.push("Inserted Group 27 under Bravo classification");

    // ============================================================
    // Verification snapshot
    // ============================================================

    const { rows: bravoModels } = await sql`
      SELECT battery_models.code, battery_models.display_name
      FROM battery_models
      JOIN battery_types ON battery_types.id = battery_models.battery_type_id
      WHERE battery_types.code = 'Bravo'
      ORDER BY battery_models.code;
    `;
    results.push(`Bravo models now: ${bravoModels.map(m => m.code).join(", ")}`);

    const { rows: total } = await sql`
      SELECT COUNT(*)::int AS count FROM battery_models;
    `;
    results.push(`Total battery_models count: ${total[0].count}`);

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
