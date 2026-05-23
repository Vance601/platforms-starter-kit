import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.MIGRATE_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Columns on battery_movements (to confirm we can log a core return without a migration).
    const { rows: movementColumns } = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'battery_movements'
      ORDER BY ordinal_position;
    `;

    // The battery_status enum values (confirm returned_core is present).
    const { rows: enumValues } = await sql`
      SELECT e.enumlabel AS value
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = 'battery_status'
      ORDER BY e.enumsortorder;
    `;

    // Core accountability snapshot with current data.
    const { rows: coreSnapshot } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE mbs_invoice_id IS NOT NULL)::int AS cores_owed,
        COUNT(*) FILTER (WHERE status = 'returned_core')::int AS cores_returned,
        COUNT(*) FILTER (WHERE status = 'sold')::int AS sold_not_returned
      FROM batteries;
    `;

    return NextResponse.json({
      ok: true,
      movementColumns,
      enumValues,
      coreSnapshot: coreSnapshot[0],
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
