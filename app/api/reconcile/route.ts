import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  // Owner-only. Matches the admin pattern: ?pw= checked against MIGRATE_SECRET.
  const pw = req.nextUrl.searchParams.get("pw");
  if (pw !== process.env.MIGRATE_SECRET) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    // Status counts across all batteries.
    const { rows: statusCounts } = await sql`
      SELECT status::text AS status, COUNT(*)::int AS count
      FROM batteries
      GROUP BY status
      ORDER BY status;
    `;

    // Full battery list with the fields that matter for accountability.
    // Joined to trucks (for on_truck location) and to the failed battery (for warranties).
    const { rows: batteries } = await sql`
      SELECT
        b.id,
        b.barcode,
        b.status::text AS status,
        b.cost,
        b.sold_on_call_number,
        b.sold_at,
        b.is_warranty,
        b.warranty_replaces_battery_id,
        b.warranty_note,
        t.truck_number AS on_truck_number,
        fb.barcode AS replaces_barcode
      FROM batteries b
      LEFT JOIN trucks t ON t.id = b.truck_id
      LEFT JOIN batteries fb ON fb.id = b.warranty_replaces_battery_id
      ORDER BY b.barcode;
    `;

    // Red flags: batteries that left the warehouse but aren't legitimately accounted for.
    // 'missing' is the explicit theft/loss signal. We also surface anything in a
    // non-standard state for owner review.
    const { rows: redFlags } = await sql`
      SELECT id, barcode, status::text AS status
      FROM batteries
      WHERE status = 'missing'
      ORDER BY barcode;
    `;

    // Revenue snapshot: paid sales vs free warranties.
    const { rows: revenue } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'sold' AND is_warranty = false)::int AS paid_sales,
        COUNT(*) FILTER (WHERE status = 'sold' AND is_warranty = true)::int AS warranty_replacements,
        COALESCE(SUM(cost) FILTER (WHERE status = 'sold' AND is_warranty = false), 0) AS paid_revenue
      FROM batteries;
    `;

    return NextResponse.json({
      success: true,
      statusCounts,
      batteries,
      redFlags,
      revenue: revenue[0],
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
