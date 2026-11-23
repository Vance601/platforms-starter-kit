import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";
import { ensureSaleTables } from "@/lib/sale-records";
import { ensureLoggedByDriverColumn } from "@/lib/driver-roles";

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
      salesDetail: [],
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

    await ensureSaleTables();

    // Optional `sales` table (QuickBooks / retail). May not exist in every env.
    const { rows: salesTable } = await sql`
      SELECT to_regclass('public.sales') IS NOT NULL AS exists;
    `;
    const hasSales = !!(salesTable[0] as { exists?: boolean } | undefined)?.exists;

    await ensureLoggedByDriverColumn();
    const detailSql = hasSales
      ? sql`
      SELECT
        d.id AS driver_id,
        d.name AS driver_name,
        m.occurred_at AS sold_at,
        COALESCE(mdl.code, sr.battery_group, bt.name) AS battery_group,
        b.barcode,
        b.serial_number,
        s.quickbooks_invoice_id,
        COALESCE(s.towbook_call_number, b.sold_on_call_number, m.call_reference, sr.call_number) AS call_number,
        COALESCE(cust.name, s.customer_name) AS customer,
        COALESCE(b.is_warranty, sr.is_warranty_install, false) AS is_warranty,
        s.sale_amount,
        b.cost,
        cr.status AS core_status,
        t.truck_number,
        b.id AS battery_id,
        m.id AS movement_id,
        ld.name AS logged_by_name
      FROM battery_movements m
      JOIN drivers d ON d.id = m.driver_id
      JOIN batteries b ON b.id = m.battery_id
      LEFT JOIN drivers ld ON ld.id = m.logged_by_driver_id
      LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
      LEFT JOIN battery_types bt ON bt.id = b.battery_type_id
      LEFT JOIN sale_records sr ON sr.movement_id = m.id
      LEFT JOIN customers cust ON cust.id = sr.customer_id
      LEFT JOIN LATERAL (
        SELECT sale_amount, quickbooks_invoice_id, towbook_call_number, customer_name
        FROM sales s2
        WHERE s2.battery_id = b.id
        ORDER BY s2.sold_at DESC NULLS LAST
        LIMIT 1
      ) s ON true
      LEFT JOIN LATERAL (
        SELECT c.status FROM core_returns c
        WHERE c.battery_id = b.id
        ORDER BY c.returned_at DESC NULLS LAST
        LIMIT 1
      ) cr ON true
      LEFT JOIN trucks t ON t.id = m.from_truck_id
      WHERE m.to_status = 'sold'
        AND m.occurred_at >= ${startISO}
        AND m.occurred_at <= ${endISO}
        AND b.company_id IN (SELECT id FROM companies WHERE org_id = ${user.orgId})
      ORDER BY d.name ASC, m.occurred_at DESC;
    `
      : sql`
      SELECT
        d.id AS driver_id,
        d.name AS driver_name,
        m.occurred_at AS sold_at,
        COALESCE(mdl.code, sr.battery_group, bt.name) AS battery_group,
        b.barcode,
        b.serial_number,
        NULL::text AS quickbooks_invoice_id,
        COALESCE(b.sold_on_call_number, m.call_reference, sr.call_number) AS call_number,
        cust.name AS customer,
        COALESCE(b.is_warranty, sr.is_warranty_install, false) AS is_warranty,
        NULL::numeric AS sale_amount,
        b.cost,
        cr.status AS core_status,
        t.truck_number,
        b.id AS battery_id,
        m.id AS movement_id,
        ld.name AS logged_by_name
      FROM battery_movements m
      JOIN drivers d ON d.id = m.driver_id
      JOIN batteries b ON b.id = m.battery_id
      LEFT JOIN drivers ld ON ld.id = m.logged_by_driver_id
      LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
      LEFT JOIN battery_types bt ON bt.id = b.battery_type_id
      LEFT JOIN sale_records sr ON sr.movement_id = m.id
      LEFT JOIN customers cust ON cust.id = sr.customer_id
      LEFT JOIN LATERAL (
        SELECT c.status FROM core_returns c
        WHERE c.battery_id = b.id
        ORDER BY c.returned_at DESC NULLS LAST
        LIMIT 1
      ) cr ON true
      LEFT JOIN trucks t ON t.id = m.from_truck_id
      WHERE m.to_status = 'sold'
        AND m.occurred_at >= ${startISO}
        AND m.occurred_at <= ${endISO}
        AND b.company_id IN (SELECT id FROM companies WHERE org_id = ${user.orgId})
      ORDER BY d.name ASC, m.occurred_at DESC;
    `;

    let salesDetail: Record<string, unknown>[] = [];
    try {
      const { rows } = await detailSql;
      salesDetail = rows;
    } catch (detailErr) {
      // sale_records / battery_models may be missing in a bare schema; still return totals.
      console.error("driver-sales detail query failed", detailErr instanceof Error ? detailErr.message : detailErr);
    }

    return NextResponse.json({
      success: true,
      range: { start: startISO, end: endISO },
      salesByDriver,
      typeByDriver,
      coresByDriver,
      salesDetail,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
