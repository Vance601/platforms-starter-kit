// app/api/core-reconcile/route.ts
// READ-ONLY per-driver core reconciliation.
// Owner-only: ?pw= checked against MIGRATE_SECRET.
// Driver attribution = battery_movements.driver_id (drivers table).

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function checkPw(req: NextRequest): boolean {
  const pw = req.nextUrl.searchParams.get("pw");
  return pw === process.env.MIGRATE_SECRET;
}

export async function GET(req: NextRequest) {
  if (!checkPw(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { rows } = await sql`
      WITH sale_moves AS (
        SELECT
          bm.battery_id,
          bm.driver_id AS driver_id,
          b.is_warranty
        FROM battery_movements bm
        LEFT JOIN batteries b ON b.id = bm.battery_id
        WHERE bm.to_status = 'sold'
          AND bm.driver_id IS NOT NULL
      ),
      core_status AS (
        SELECT
          sm.driver_id,
          COUNT(*) FILTER (WHERE cr.status = 'owed')::int     AS cores_owed,
          COUNT(*) FILTER (WHERE cr.status = 'returned')::int AS cores_returned
        FROM sale_moves sm
        LEFT JOIN core_returns cr ON cr.battery_id = sm.battery_id
        GROUP BY sm.driver_id
      ),
      sale_counts AS (
        SELECT
          sm.driver_id,
          COUNT(*)::int AS sold_total,
          COUNT(*) FILTER (WHERE sm.is_warranty = true)::int  AS warranties,
          COUNT(*) FILTER (WHERE sm.is_warranty = false OR sm.is_warranty IS NULL)::int AS regular_sales
        FROM sale_moves sm
        GROUP BY sm.driver_id
      )
      SELECT
        COALESCE(d.name, 'Unknown driver') AS driver_name,
        sc.driver_id,
        COALESCE(sc.regular_sales, 0) AS regular_sales,
        COALESCE(sc.warranties, 0)    AS warranties,
        COALESCE(sc.sold_total, 0)    AS sold_total,
        COALESCE(cs.cores_owed, 0)    AS cores_owed,
        COALESCE(cs.cores_returned, 0) AS cores_returned
      FROM sale_counts sc
      LEFT JOIN core_status cs ON cs.driver_id = sc.driver_id
      LEFT JOIN drivers d      ON d.id = sc.driver_id
      ORDER BY cores_owed DESC, driver_name ASC;
    `;

    const totals = rows.reduce(
      (acc, r: Record<string, number>) => {
        acc.regular_sales += Number(r.regular_sales) || 0;
        acc.warranties += Number(r.warranties) || 0;
        acc.sold_total += Number(r.sold_total) || 0;
        acc.cores_owed += Number(r.cores_owed) || 0;
        acc.cores_returned += Number(r.cores_returned) || 0;
        return acc;
      },
      { regular_sales: 0, warranties: 0, sold_total: 0, cores_owed: 0, cores_returned: 0 }
    );

    return NextResponse.json({ success: true, drivers: rows, totals });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
