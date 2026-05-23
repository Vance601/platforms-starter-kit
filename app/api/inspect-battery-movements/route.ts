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
    // Foreign keys ON the batteries table — what each FK column actually points to.
    const { rows: batteryForeignKeys } = await sql`
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
        AND tc.table_name = 'batteries'
      ORDER BY kcu.column_name;
    `;

    // The battery_status enum values.
    const { rows: statusEnum } = await sql`
      SELECT e.enumlabel AS value, e.enumsortorder AS sort_order
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = 'battery_status'
      ORDER BY e.enumsortorder;
    `;

    // Count batteries by status.
    const { rows: statusCounts } = await sql`
      SELECT status::text AS status, COUNT(*)::int AS count
      FROM batteries
      GROUP BY status
      ORDER BY status;
    `;

    return NextResponse.json({
      success: true,
      battery_foreign_keys: batteryForeignKeys,
      battery_status_enum: statusEnum,
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
