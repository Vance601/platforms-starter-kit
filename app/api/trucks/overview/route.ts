import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Live truck overview: each truck with its current driver, batteries on truck,
// and cores still owed by that driver. Cores are driver-based because drivers
// swap trucks daily — what matters is "is the driver currently here returning
// their cores?" rather than which truck the sale was made off of.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Not signed in." },
        { status: 401 }
      );
    }

    const { rows } = await sql`
      SELECT
        t.id,
        t.truck_number,
        t.year_model,
        t.vin_last5,
        t.active,
        c.name AS company_name,
        c.slug AS company_slug,
        d.id   AS current_driver_id,
        d.name AS current_driver_name,
        (
          SELECT COUNT(*)::int FROM batteries b
          WHERE b.current_truck_id = t.id AND b.status = 'on_truck'
        ) AS batteries_on_truck,
        CASE WHEN d.id IS NULL THEN 0 ELSE (
          SELECT COUNT(*)::int FROM core_returns cr
          WHERE cr.status = 'owed'
            AND cr.battery_id IN (
              SELECT bm.battery_id FROM battery_movements bm
              WHERE bm.driver_id = d.id AND bm.to_status = 'sold'
            )
        ) END AS owed_cores
      FROM trucks t
      LEFT JOIN companies c ON c.id = t.company_id
      LEFT JOIN drivers d   ON d.id = t.current_driver_id
      ORDER BY t.truck_number ASC;
    `;

    return NextResponse.json({ success: true, trucks: rows });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
