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
    // Full picture of both test batteries: status, sale, and warranty link.
    const { rows: batteries } = await sql`
      SELECT id, barcode, status, cost, sold_on_call_number,
             is_warranty, warranty_replaces_battery_id, warranty_note
      FROM batteries
      ORDER BY barcode;
    `;

    // Status counts.
    const { rows: statusCounts } = await sql`
      SELECT status::text AS status, COUNT(*)::int AS count
      FROM batteries
      GROUP BY status
      ORDER BY status;
    `;

    return NextResponse.json({
      success: true,
      batteries,
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
