import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.MIGRATE_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { rows: columns } = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'batteries'
      ORDER BY ordinal_position;
    `;

    const { rows: byStatus } = await sql`
      SELECT status::text AS status, COUNT(*)::int AS count
      FROM batteries
      GROUP BY status
      ORDER BY status;
    `;

    const { rows: mbsInfo } = await sql`
      SELECT
        COUNT(*)::int AS total_batteries,
        COUNT(mbs_invoice_id)::int AS with_mbs_invoice,
        COUNT(*) FILTER (WHERE received_at IS NOT NULL)::int AS with_received_at
      FROM batteries;
    `;

    const { rows: sample } = await sql`
      SELECT id, barcode, status::text AS status, mbs_invoice_id, received_at, sold_at
      FROM batteries
      ORDER BY created_at DESC
      LIMIT 5;
    `;

    return NextResponse.json({
      ok: true,
      columns,
      byStatus,
      mbsInfo: mbsInfo[0],
      sample,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
