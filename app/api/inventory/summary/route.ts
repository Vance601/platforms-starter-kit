
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isSignedIn } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Real inventory summary, read live from Neon. Drives both the Inventory page
// and the Dashboard summary tiles. No hardcoded types/locations — everything
// comes from the database, so it stays correct as stock changes.
export async function GET() {
  try {
    const signedIn = await isSignedIn();
    if (!signedIn) {
      return NextResponse.json(
        { success: false, error: "Not signed in." },
        { status: 401 }
      );
    }

    const { rows } = await sql`
      SELECT
        bt.name AS battery_type,
        l.name  AS location,
        b.status AS status,
        count(*)::int AS count
      FROM batteries b
      LEFT JOIN battery_types bt ON bt.id = b.battery_type_id
      LEFT JOIN locations     l  ON l.id  = b.location_id
      GROUP BY bt.name, l.name, b.status;
    `;

    let total = 0;
    const byType: Record<string, number> = {};
    const byLocation: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const typeLocation: Record<string, Record<string, number>> = {};

    for (const r of rows) {
      const type = r.battery_type || "Unknown";
      const loc = r.location || "Unassigned";
      const status = r.status || "unknown";
      const n = r.count || 0;

      total += n;
      byType[type] = (byType[type] || 0) + n;
      byLocation[loc] = (byLocation[loc] || 0) + n;
      byStatus[status] = (byStatus[status] || 0) + n;

      if (!typeLocation[type]) typeLocation[type] = {};
      typeLocation[type][loc] = (typeLocation[type][loc] || 0) + n;
    }

    const inWarehouse = byStatus["in_warehouse"] || 0;
    const onTruck = byStatus["on_truck"] || 0;
    const returnedCore = byStatus["returned_core"] || 0;

    return NextResponse.json({
      success: true,
      total,
      inWarehouse,
      onTruck,
      returnedCore,
      byType,
      byLocation,
      byStatus,
      typeLocation,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
