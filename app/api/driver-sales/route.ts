import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET ?start=YYYY-MM-DD&end=YYYY-MM-DD
// Owner-facing driver sales report, scoped to the caller's organization.
// All money figures, where present, are WHOLESALE COST only (batteries.cost). No retail.
export async function GET(req: NextRequest) {
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
      range: { start: null, end: null },
      salesByDriver: [],
      typeByDriver: [],
      coresByDriver: [],
    });
  }

  // Date range. Default to the last 30 days if not provided.
  const startParam = req.nextUrl.searchParams.get("start");
  const endParam = req.nextUrl.searchParams.get("end");

  const end = endParam ? new Date(endParam) : new Date();
  const start = startParam
    ? new Date(startParam)
    : new Date(new Date().setDate(new Date().getDate() - 30));

  // Normalize to cover the full end day (inclusive).
  const startISO = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0).toISOString();
  const endISO = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59).toISOString();

  try {
    // Per-driver SALES: count of sold-movements and warranty subset, in range.
    const { rows: salesByDriver } = await sql`
      SELECT
        d.id AS driver_id,
        d.name AS driver_name,
        COUNT(*)::int AS units_sold,
        COUNT(*) FILTER (WHERE b.is_warranty = true)::int AS warranties
      FROM battery_movements m
      JOIN drivers d ON d.id = m.driver_id
      JOIN batteries b ON b.id = m.battery_id
      WHERE m.to_status = 'sold'
        AND m.occurred_at >= ${startISO}
        AND m.occurred_at <= ${endISO}
        AND b.company_id IN (SELECT id FROM companies WHERE org_id = ${user.orgId})
      GROUP BY d.id, d.name
      ORDER BY units_sold DESC, d.name ASC;
    `;

    // Per-driver TYPE BREAKDOWN of sold batteries, in range.
    const { rows: typeByDriver } = await sql`
      SELECT
        m.driver_id AS driver_id,
        bt.name AS type_name,
        COUNT(*)::int AS count
      FROM battery_movements m
      JOIN batteries b ON b.id = m.battery_id
      JOIN battery_types bt ON bt.id = b.battery_type_id
      WHERE m.to_status = 'sold'
        AND m.occurred_at >= ${startISO}
        AND m.occurred_at <= ${endISO}
        AND b.company_id IN (SELECT id FROM companies WHERE org_id = ${user.orgId})
      GROUP BY m.driver_id, bt.name
      ORDER BY m.driver_id, bt.name;
    `;

    // Per-driver CORES RETURNED, in range.
    const { rows: coresByDriver } = await sql`
      SELECT
        m.driver_id AS driver_id,
        COUNT(*)::int AS cores_returned
      FROM battery_movements m
      JOIN batteries b ON b.id = m.battery_id
      WHERE m.to_status = 'returned_core'
        AND m.occurred_at >= ${startISO}
        AND m.occurred_at <= ${endISO}
        AND b.company_id IN (SELECT id FROM companies WHERE org_id = ${user.orgId})
      GROUP BY m.driver_id;
    `;

    return NextResponse.json({
      success: true,
      range: { start: startISO, end: endISO },
      salesByDriver,
      typeByDriver,
      coresByDriver,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
