import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/dashboard/charts?start=YYYY-MM-DD&end=YYYY-MM-DD
//
// Feeds the Dashboard analytics section. Everything here is real data read
// live from Neon -- no mock series.
//
// Tenancy: scoped to the caller's organization via
//   batteries -> companies (company_id) -> organizations (org_id)
// Fail-closed: no orgId means empty payload rather than another org's numbers.
//
// Date range is OPTIONAL. Omitting start/end means "all time", which is the
// honest default while the dataset is still small.
//
// Note on what the range does and does not affect:
//   - inventory composition is a CURRENT snapshot (what is on hand right now),
//     so it deliberately ignores the range.
//   - movements and units-sold are event streams, so they DO respect it.
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
    }
    if (!user.orgId) {
      // No tenant context -- return an empty but well-formed payload.
      return NextResponse.json({
        success: true,
        start: null,
        end: null,
        inventoryByStatus: [],
        locationTypes: [],
        typeNames: [],
        movementFlow: [],
        approvalBreakdown: [],
        unitsSoldByMonth: [],
        totals: { batteries: 0, movements: 0, unitsSold: 0, returnedCore: 0, orphanedBatteries: 0 },
      });
    }

    const { searchParams } = new URL(req.url);
    const rawStart = searchParams.get("start");
    const rawEnd = searchParams.get("end");
    // Normalise "" to null so the SQL guards below treat it as "no bound".
    const start = rawStart && rawStart.trim() !== "" ? rawStart : null;
    const end = rawEnd && rawEnd.trim() !== "" ? rawEnd : null;

    const org = user.orgId;

    // 1. Current inventory by status (snapshot -- ignores date range).
    const statusRows = await sql`
      SELECT b.status::text AS status, count(*)::int AS count
      FROM batteries b
      JOIN companies c ON c.id = b.company_id
      WHERE c.org_id = ${org}
      GROUP BY b.status
      ORDER BY count DESC;
    `;

    // 2. Current inventory by location, broken out by battery type.
    const locTypeRows = await sql`
      SELECT
        COALESCE(l.name, 'Unassigned')  AS location,
        COALESCE(bt.name, 'Unknown')    AS type,
        count(*)::int                   AS count
      FROM batteries b
      JOIN companies c ON c.id = b.company_id
      LEFT JOIN locations     l  ON l.id  = b.location_id
      LEFT JOIN battery_types bt ON bt.id = b.battery_type_id
      WHERE c.org_id = ${org}
      GROUP BY 1, 2
      ORDER BY 1, 2;
    `;

    // 3. Movement flow: how stock actually travels, from_status -> to_status.
    const flowRows = await sql`
      SELECT
        COALESCE(m.from_status::text, 'new')     AS from_status,
        COALESCE(m.to_status::text, 'unknown')   AS to_status,
        count(*)::int                            AS count
      FROM battery_movements m
      JOIN batteries b ON b.id = m.battery_id
      JOIN companies c ON c.id = b.company_id
      WHERE c.org_id = ${org}
        AND (${start}::text IS NULL OR m.occurred_at >= ${start}::timestamp)
        AND (${end}::text   IS NULL OR m.occurred_at <  (${end}::date + INTERVAL '1 day'))
      GROUP BY 1, 2
      ORDER BY count DESC;
    `;

    // 3b. Approval mix on those movements. Values are read from the data
    // rather than assumed, so this stays correct whatever the column holds.
    const approvalRows = await sql`
      SELECT
        COALESCE(m.approval_status, '(not set)') AS approval_status,
        count(*)::int                            AS count
      FROM battery_movements m
      JOIN batteries b ON b.id = m.battery_id
      JOIN companies c ON c.id = b.company_id
      WHERE c.org_id = ${org}
        AND (${start}::text IS NULL OR m.occurred_at >= ${start}::timestamp)
        AND (${end}::text   IS NULL OR m.occurred_at <  (${end}::date + INTERVAL '1 day'))
      GROUP BY 1
      ORDER BY count DESC;
    `;

    // 4. Units sold by month.
    //
    // Deliberately keyed off sold_at, NOT status = 'sold'. A battery that was
    // sold and later had its core returned moves to status 'returned_core'
    // but is still a sale. Filtering on status undercounts.
    const soldRows = await sql`
      SELECT
        to_char(date_trunc('month', b.sold_at), 'YYYY-MM') AS month,
        count(*)::int                                      AS count
      FROM batteries b
      JOIN companies c ON c.id = b.company_id
      WHERE c.org_id = ${org}
        AND b.sold_at IS NOT NULL
        AND (${start}::text IS NULL OR b.sold_at >= ${start}::timestamp)
        AND (${end}::text   IS NULL OR b.sold_at <  (${end}::date + INTERVAL '1 day'))
      GROUP BY 1
      ORDER BY 1;
    `;

    // 5. Headline totals.
    const totalsRows = await sql`
      SELECT
        count(*)::int                                                  AS batteries,
        count(*) FILTER (WHERE b.sold_at IS NOT NULL)::int             AS units_sold_all_time,
        count(*) FILTER (WHERE b.status::text = 'returned_core')::int  AS returned_core
      FROM batteries b
      JOIN companies c ON c.id = b.company_id
      WHERE c.org_id = ${org};
    `;

    // 6. Diagnostic: batteries not reachable through any company. These are
    // invisible to every org-scoped query, so surface the count rather than
    // silently dropping them.
    const orphanRows = await sql`
      SELECT count(*)::int AS orphaned
      FROM batteries b
      LEFT JOIN companies c ON c.id = b.company_id
      WHERE c.id IS NULL;
    `;

    // Pivot location/type rows into one object per location for a stacked bar.
    const typeSet = new Set<string>();
    const byLocation = new Map<string, Record<string, string | number>>();
    for (const r of locTypeRows.rows) {
      const loc = r.location as string;
      const type = r.type as string;
      const n = r.count as number;
      typeSet.add(type);
      if (!byLocation.has(loc)) byLocation.set(loc, { location: loc, total: 0 });
      const entry = byLocation.get(loc)!;
      entry[type] = ((entry[type] as number) || 0) + n;
      entry.total = ((entry.total as number) || 0) + n;
    }
    const typeNames = Array.from(typeSet).sort();
    const locationTypes = Array.from(byLocation.values()).sort(
      (a, b) => (b.total as number) - (a.total as number)
    );
    // Fill missing type keys with 0 so Recharts stacks render consistently.
    for (const row of locationTypes) {
      for (const t of typeNames) if (row[t] === undefined) row[t] = 0;
    }

    const PRETTY: Record<string, string> = {
      in_warehouse: "In warehouse",
      on_truck: "On truck",
      sold: "Sold",
      returned_core: "Returned core",
      new: "New",
      unknown: "Unknown",
    };
    const pretty = (s: string) => PRETTY[s] || s.replace(/_/g, " ");

    const inventoryByStatus = statusRows.rows.map((r) => ({
      status: r.status as string,
      label: pretty(r.status as string),
      count: r.count as number,
    }));

    const movementFlow = flowRows.rows.map((r) => ({
      from: r.from_status as string,
      to: r.to_status as string,
      label: `${pretty(r.from_status as string)} → ${pretty(r.to_status as string)}`,
      count: r.count as number,
    }));

    const approvalBreakdown = approvalRows.rows.map((r) => ({
      status: r.approval_status as string,
      count: r.count as number,
    }));

    const unitsSoldByMonth = soldRows.rows.map((r) => ({
      month: r.month as string,
      count: r.count as number,
    }));

    const t = totalsRows.rows[0] || {};
    const movementsInRange = movementFlow.reduce((acc, m) => acc + m.count, 0);
    const unitsSoldInRange = unitsSoldByMonth.reduce((acc, m) => acc + m.count, 0);

    return NextResponse.json({
      success: true,
      start,
      end,
      inventoryByStatus,
      locationTypes,
      typeNames,
      movementFlow,
      approvalBreakdown,
      unitsSoldByMonth,
      totals: {
        batteries: (t.batteries as number) ?? 0,
        movements: movementsInRange,
        unitsSold: unitsSoldInRange,
        unitsSoldAllTime: (t.units_sold_all_time as number) ?? 0,
        returnedCore: (t.returned_core as number) ?? 0,
        orphanedBatteries: (orphanRows.rows[0]?.orphaned as number) ?? 0,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
