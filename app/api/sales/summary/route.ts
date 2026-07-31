import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Units-sold summary for a date range, grouped by location then battery model.
// Counts only (no dollars). Reads batteries.sold_at; no sales-table dependency.
//
// Two corrections vs. the earlier version of this route:
//
// 1. TENANCY. It used to check only "is signed in", so any signed-in user
//    would have seen every organization's sales. Now scoped through
//    batteries -> companies (company_id) -> organizations (org_id),
//    failing closed when the caller has no orgId.
//
// 2. UNDERCOUNT. It used to filter on status = 'sold' AND sold_at IS NOT NULL.
//    A battery that was sold and later had its core returned moves to status
//    'returned_core' while keeping its sold_at, so those sales were dropped.
//    Sales are now counted purely from sold_at, which is the field that
//    actually records the sale.
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not signed in." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start"); // "YYYY-MM-DD"
    const end = searchParams.get("end");     // "YYYY-MM-DD"

    if (!start || !end) {
      return NextResponse.json(
        { success: false, error: "start and end dates are required." },
        { status: 400 }
      );
    }

    if (!user.orgId) {
      return NextResponse.json({
        success: true,
        start,
        end,
        grandTotal: 0,
        locations: [],
      });
    }

    // Inclusive range: from start 00:00:00 through end 23:59:59.
    const { rows } = await sql`
      SELECT
        l.id   AS location_id,
        l.name AS location_name,
        c.name AS company_name,
        bmod.code AS battery_code,
        COUNT(*)::int AS units_sold
      FROM batteries b
      JOIN companies c ON c.id = b.company_id
      LEFT JOIN locations l         ON l.id = b.location_id
      LEFT JOIN battery_models bmod ON bmod.id = b.battery_model_id
      WHERE c.org_id = ${user.orgId}
        AND b.sold_at IS NOT NULL
        AND b.sold_at >= ${start}::timestamp
        AND b.sold_at < (${end}::date + INTERVAL '1 day')
      GROUP BY l.id, l.name, c.name, bmod.code
      ORDER BY l.name NULLS LAST, units_sold DESC;
    `;

    type ModelCount = { code: string; n: number };
    type LocationGroup = {
      location_id: string | null;
      location_name: string;
      company_name: string | null;
      total: number;
      models: ModelCount[];
    };

    const byLocation = new Map<string, LocationGroup>();
    let grandTotal = 0;

    for (const r of rows) {
      const key = (r.location_id as string | null) ?? "unassigned";
      const name = (r.location_name as string | null) ?? "Unassigned location";
      const code = (r.battery_code as string | null) ?? "-";
      const n = r.units_sold as number;
      grandTotal += n;

      if (!byLocation.has(key)) {
        byLocation.set(key, {
          location_id: (r.location_id as string | null) ?? null,
          location_name: name,
          company_name: (r.company_name as string | null) ?? null,
          total: 0,
          models: [],
        });
      }
      const grp = byLocation.get(key)!;
      grp.total += n;
      grp.models.push({ code, n });
    }

    const locations = Array.from(byLocation.values()).sort(
      (a, b) => b.total - a.total
    );

    return NextResponse.json({
      success: true,
      start,
      end,
      grandTotal,
      locations,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        locations: [],
        error: err instanceof Error ? err.message : "unknown error",
      },
      { status: 500 }
    );
  }
}
