import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isSignedIn } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const signedIn = await isSignedIn();
  if (!signedIn) {
    return NextResponse.json(
      { success: false, error: "Not signed in." },
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

    // Aging inventory: batteries currently ON A TRUCK, how long they've been there,
    // and which driver is accountable. The load event lives in battery_movements
    // (to_status = 'on_truck'); we take the most recent one per battery for the
    // load date and the driver who loaded it. We also show the truck's current driver.
    // days_on_truck drives the green/yellow/red flag on the page (red at 14+).
    const { rows: agingOnTruck } = await sql`
      SELECT
        b.id,
        b.barcode,
        t.truck_number,
        loader.name AS loaded_by,
        holder.name AS current_holder,
        lm.occurred_at AS loaded_at,
        FLOOR(EXTRACT(EPOCH FROM (now() - lm.occurred_at)) / 86400)::int AS days_on_truck
      FROM batteries b
      LEFT JOIN trucks t ON t.id = b.truck_id
      LEFT JOIN drivers holder ON holder.id = t.current_driver_id
      LEFT JOIN LATERAL (
        SELECT m.driver_id, m.occurred_at
        FROM battery_movements m
        WHERE m.battery_id = b.id
          AND m.to_status = 'on_truck'
        ORDER BY m.occurred_at DESC
        LIMIT 1
      ) lm ON true
      LEFT JOIN drivers loader ON loader.id = lm.driver_id
      WHERE b.status = 'on_truck'
      ORDER BY lm.occurred_at ASC NULLS FIRST;
    `;

    // Cost summary: this program tracks the wholesale COST paid for batteries,
    // not selling-price income. total_cost is the sum of cost across sold, non-warranty
    // units (warranty replacements are free, so they carry no cost here).
    const { rows: costSummary } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'sold' AND is_warranty = false)::int AS sold_units,
        COUNT(*) FILTER (WHERE status = 'sold' AND is_warranty = true)::int AS warranty_replacements,
        COALESCE(SUM(cost) FILTER (WHERE status = 'sold' AND is_warranty = false), 0) AS total_cost
      FROM batteries;
    `;

    // Core accountability: REGULAR cores only (warranty cores are tracked separately
    // on the Warranty Report, so we exclude is_warranty = true here to avoid double-counting).
    // Every regular battery bought from the supplier (has an mbs_invoice_id) carries 1 core charge = 1 core owed.
    // A core is recovered when its battery is marked status = 'returned_core'.
    // Outstanding = owed - returned = regular cores not yet returned.
    const { rows: coreAccountability } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE mbs_invoice_id IS NOT NULL AND is_warranty = false)::int AS owed,
        COUNT(*) FILTER (WHERE status = 'returned_core' AND is_warranty = false)::int AS returned,
        (
          COUNT(*) FILTER (WHERE mbs_invoice_id IS NOT NULL AND is_warranty = false)
          - COUNT(*) FILTER (WHERE status = 'returned_core' AND is_warranty = false)
        )::int AS outstanding
      FROM batteries;
    `;

    return NextResponse.json({
      success: true,
      statusCounts,
      batteries,
      redFlags,
      agingOnTruck,
      costSummary: costSummary[0],
      coreAccountability: coreAccountability[0],
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
