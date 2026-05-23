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
    // FKs on battery_movements — do its driver columns point to users or drivers?
    const { rows: movementForeignKeys } = await sql`
      SELECT
        kcu.column_name AS fk_column,
        ccu.table_name AS references_table,
        ccu.column_name AS references_column,
        tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'battery_movements'
      ORDER BY kcu.column_name;
    `;

    // Status counts (sanity check — should still be in_warehouse: 2).
    const { rows: statusCounts } = await sql`
      SELECT status::text AS status, COUNT(*)::int AS count
      FROM batteries
      GROUP BY status
      ORDER BY status;
    `;

    return NextResponse.json({
      success: true,
      battery_movements_foreign_keys: movementForeignKeys,
      battery_status_counts: statusCounts,
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
