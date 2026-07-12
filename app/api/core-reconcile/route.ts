// app/api/core-reconcile/route.ts
// READ-ONLY per-driver core reconciliation.
// Owner/manager only, scoped to the caller's organization.
// Driver attribution = battery_movements.driver_id (drivers table).
//
// RULE: REGULAR sales owe a core back to the warehouse, tracked in core_returns.
// WARRANTY replacements owe their core through the separate warranty-return system,
// so they are shown for visibility but NOT counted in this "still owes" figure.
//   still_owes = regular_sales - regular_cores_turned_in

import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
  }
  if (user.role !== "owner" && user.role !== "manager") {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }
  if (!user.orgId) {
    return NextResponse.json({
      success: true,
      drivers: [],
      totals: { regular_sales: 0, warranties: 0, sold_total: 0, cores_returned: 0, still_owes: 0 },
    });
  }

  try {
    const { rows } = await sql`
      WITH sale_moves AS (
        SELECT
          bm.battery_id,
          bm.driver_id AS driver_id,
          COALESCE(b.is_warranty, false) AS is_warranty
        FROM battery_movements bm
        JOIN batteries b ON b.id = bm.battery_id
        WHERE bm.to_status = 'sold'
          AND bm.driver_id IS NOT NULL
          AND b.company_id IN (SELECT id FROM companies WHERE org_id = ${user.orgId})
      ),
      turned_in AS (
        -- cores returned for REGULAR sales only (warranty returns live elsewhere)
        SELECT
          sm.driver_id,
          COUNT(*) FILTER (WHERE cr.status = 'returned')::int AS cores_returned
        FROM sale_moves sm
        LEFT JOIN core_returns cr ON cr.battery_id = sm.battery_id
        WHERE sm.is_warranty = false
        GROUP BY sm.driver_id
      ),
      sale_counts AS (
        SELECT
          sm.driver_id,
          COUNT(*)::int AS sold_total,
          COUNT(*) FILTER (WHERE sm.is_warranty = true)::int  AS warranties,
          COUNT(*) FILTER (WHERE sm.is_warranty = false)::int AS regular_sales
        FROM sale_moves sm
        GROUP BY sm.driver_id
      )
      SELECT
        COALESCE(d.name, 'Unknown driver') AS driver_name,
        sc.driver_id,
        COALESCE(sc.regular_sales, 0) AS regular_sales,
        COALESCE(sc.warranties, 0)    AS warranties,
        COALESCE(sc.sold_total, 0)    AS sold_total,
        COALESCE(ti.cores_returned, 0) AS cores_returned,
        GREATEST(COALESCE(sc.regular_sales, 0) - COALESCE(ti.cores_returned, 0), 0) AS still_owes
      FROM sale_counts sc
      LEFT JOIN turned_in ti ON ti.driver_id = sc.driver_id
      LEFT JOIN drivers d    ON d.id = sc.driver_id
      ORDER BY still_owes DESC, driver_name ASC;
    `;

    const totals = rows.reduce(
      (acc, r: Record<string, number>) => {
        acc.regular_sales += Number(r.regular_sales) || 0;
        acc.warranties += Number(r.warranties) || 0;
        acc.sold_total += Number(r.sold_total) || 0;
        acc.cores_returned += Number(r.cores_returned) || 0;
        acc.still_owes += Number(r.still_owes) || 0;
        return acc;
      },
      { regular_sales: 0, warranties: 0, sold_total: 0, cores_returned: 0, still_owes: 0 }
    );

    return NextResponse.json({ success: true, drivers: rows, totals });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
