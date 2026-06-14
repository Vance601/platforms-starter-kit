import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isSignedIn } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Live warehouse view: each location with its in-warehouse battery count, the
// number of returned cores physically sitting there (waiting for MBS pickup),
// and a breakdown of in-warehouse stock by battery model code.
export async function GET() {
  try {
    const signedIn = await isSignedIn();
    if (!signedIn) {
      return NextResponse.json(
        { success: false, error: "Not signed in." },
        { status: 401 }
      );
    }

    const { rows: locations } = await sql`
      SELECT
        l.id,
        l.name,
        c.name AS company_name,
        COUNT(b.id) FILTER (WHERE b.status = 'in_warehouse')::int  AS in_warehouse,
        COUNT(b.id) FILTER (WHERE b.status = 'returned_core')::int AS returned_cores
      FROM locations l
      LEFT JOIN companies c ON c.id = l.company_id
      LEFT JOIN batteries b ON b.location_id = l.id
      GROUP BY l.id, l.name, c.name
      ORDER BY c.name NULLS LAST, l.name;
    `;

    const { rows: breakdown } = await sql`
      SELECT
        b.location_id,
        COALESCE(bm.code, 'Unknown') AS code,
        COUNT(*)::int AS n
      FROM batteries b
      LEFT JOIN battery_models bm ON bm.id = b.battery_model_id
      WHERE b.status = 'in_warehouse'
      GROUP BY b.location_id, bm.code
      ORDER BY bm.code;
    `;

    const byLoc = new Map<string, { code: string; n: number }[]>();
    for (const row of breakdown) {
      const arr = byLoc.get(row.location_id as string) || [];
      arr.push({ code: row.code as string, n: row.n as number });
      byLoc.set(row.location_id as string, arr);
    }

    const out = locations.map((l) => ({
      ...l,
      breakdown: byLoc.get(l.id as string) || [],
    }));

    return NextResponse.json({ success: true, locations: out });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
