// Read-only daily battery-movements report. Used by GET /api/reports/daily-movements
// (CRON_SECRET). Queries are SELECT-only and always scoped to one organization
// through companies.org_id. Live columns follow the production APIs (which
// have moved past lib/db/schema.ts in places); missing optional tables are
// skipped rather than invented.
import { sql } from "@vercel/postgres";
import { getOrgSettings } from "@/lib/org-settings";
import { resolveDuggersOrg } from "@/lib/duggers-inventory-reset";
import { normalizeOrgSlug } from "@/lib/org-slug";
import { ensureLoggedByDriverColumn } from "@/lib/driver-roles";
import {
  addDaysYmd,
  asOfInstant,
  parseReportDate,
  todayYmd,
  zonedDayRange,
} from "@/lib/org-day-range";

export { addDaysYmd, asOfInstant, parseReportDate, todayYmd, zonedDayRange } from "@/lib/org-day-range";

export type ReportOrg = {
  id: string;
  slug: string;
  name: string;
  isDemo: boolean;
};

export type MovementItem = {
  time: string | null;
  timeLocal: string | null;
  barcode: string;
  serialNumber: string | null;
  model: string | null;
  type: string | null;
  qty: number;
  location: string | null;
  truck: string | null;
  [key: string]: unknown;
};

export type GroupCount = { name: string; count: number };

function iso(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatLocal(v: unknown, timeZone: string): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).format(d);
}

async function tableExists(name: string): Promise<boolean> {
  const { rows } = await sql.query(`SELECT to_regclass($1) IS NOT NULL AS exists`, [`public.${name}`]);
  return !!(rows[0] as { exists?: boolean } | undefined)?.exists;
}

function money(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function countBy(items: { [k: string]: unknown }[], key: string): GroupCount[] {
  const map = new Map<string, number>();
  for (const it of items) {
    const name = String(it[key] || "Unassigned");
    const qty = typeof it.qty === "number" && Number.isFinite(it.qty) ? it.qty : 1;
    map.set(name, (map.get(name) || 0) + qty);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function resolveReportOrgs(
  orgParam: string | null,
  includeDemo = false,
): Promise<{ orgs: ReportOrg[]; error?: string }> {
  const mapRow = (r: Record<string, unknown>): ReportOrg => ({
    id: String(r.id),
    slug: String(r.slug || ""),
    name: String(r.name || ""),
    isDemo: !!r.is_demo,
  });

  if (!orgParam) {
    const { rows } = await sql`
      SELECT o.id::text AS id, o.slug, o.name, COALESCE(o.is_demo, false) AS is_demo
      FROM organizations o
      WHERE (${includeDemo} OR COALESCE(o.is_demo, false) = false)
      ORDER BY o.name`;
    return { orgs: rows.map(mapRow) };
  }

  const raw = String(orgParam).trim();
  const slug = normalizeOrgSlug(raw);

  const { rows } = await sql`
    SELECT o.id::text AS id, o.slug, o.name, COALESCE(o.is_demo, false) AS is_demo
    FROM organizations o
    WHERE o.id::text = ${raw}
       OR lower(o.slug) = lower(${raw})
       OR lower(o.slug) = ${slug}
    LIMIT 5`;
  if (rows[0]) return { orgs: [mapRow(rows[0])] };

  const { rows: byCo } = await sql`
    SELECT DISTINCT o.id::text AS id, o.slug, o.name, COALESCE(o.is_demo, false) AS is_demo
    FROM organizations o
    JOIN companies c ON c.org_id = o.id
    WHERE lower(c.slug) = ${slug} OR lower(c.slug) = lower(${raw})
    LIMIT 5`;
  if (byCo[0]) return { orgs: [mapRow(byCo[0])] };

  if (slug === "duggers") {
    const dug = await resolveDuggersOrg();
    if (dug) {
      const { rows: r } = await sql`
        SELECT o.id::text AS id, o.slug, o.name, COALESCE(o.is_demo, false) AS is_demo
        FROM organizations o WHERE o.id::text = ${dug.orgId} LIMIT 1`;
      if (r[0]) return { orgs: [mapRow(r[0])] };
    }
  }

  return { orgs: [], error: `Organization not found: ${orgParam}` };
}

async function incomingForOrg(orgId: string, startIso: string, endIso: string, asOfIso: string, timeZone: string) {
  const { rows } = await sql`
    SELECT
      b.id,
      b.barcode,
      b.serial_number,
      COALESCE(b.received_at, b.created_at) AS received_at,
      COALESCE(mdl.code, NULL) AS model_code,
      COALESCE(bt.code, bt.name) AS type_code,
      COALESCE(al.name, l.name) AS location_name,
      at.truck_number,
      rec.name AS received_by,
      dr.supplier,
      dr.po_number,
      dr.receipt_number,
      inv.invoice_number AS mbs_invoice_number
    FROM batteries b
    JOIN companies c ON c.id = b.company_id
    LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
    LEFT JOIN battery_types bt ON bt.id = b.battery_type_id
    LEFT JOIN LATERAL (
      SELECT mm.to_truck_id, mm.to_location_id
      FROM battery_movements mm
      WHERE mm.battery_id = b.id
        AND mm.occurred_at < ${asOfIso}::timestamptz
      ORDER BY mm.occurred_at DESC, mm.id DESC
      LIMIT 1
    ) asof ON true
    LEFT JOIN locations l ON l.id = b.location_id
    LEFT JOIN locations al ON al.id = asof.to_location_id
    LEFT JOIN trucks at ON at.id = asof.to_truck_id
    LEFT JOIN delivery_receipts dr ON dr.id = b.delivery_receipt_id
    LEFT JOIN mbs_invoices inv ON inv.id = b.mbs_invoice_id
    LEFT JOIN LATERAL (
      SELECT m.recorded_by_id
      FROM battery_movements m
      WHERE m.battery_id = b.id
        AND m.to_status = 'in_warehouse'
        AND m.from_status IS NULL
      ORDER BY m.occurred_at ASC
      LIMIT 1
    ) first_mv ON true
    LEFT JOIN users rec ON rec.id = COALESCE(first_mv.recorded_by_id, dr.uploaded_by_id, inv.uploaded_by_id)
    WHERE c.org_id = ${orgId}
      AND COALESCE(b.received_at, b.created_at) >= ${startIso}::timestamptz
      AND COALESCE(b.received_at, b.created_at) < ${endIso}::timestamptz
    ORDER BY received_at ASC, b.barcode`;

  const items = rows.map((r) => ({
    time: iso(r.received_at),
    timeLocal: formatLocal(r.received_at, timeZone),
    barcode: String(r.barcode || ""),
    serialNumber: (r.serial_number as string) || null,
    model: (r.model_code as string) || null,
    type: (r.type_code as string) || null,
    qty: 1,
    location: (r.location_name as string) || null,
    truck: (r.truck_number as string) || null,
    receivedBy: (r.received_by as string) || null,
    supplier: (r.supplier as string) || null,
    poNumber: (r.po_number as string) || null,
    receiptNumber: (r.receipt_number as string) || null,
    mbsInvoiceNumber: (r.mbs_invoice_number as string) || null,
  }));
  return {
    count: items.length,
    items,
    byLocation: countBy(items, "location"),
    byTruck: countBy(items, "truck"),
  };
}

async function soldForOrg(orgId: string, startIso: string, endIso: string, asOfIso: string, timeZone: string, hasSales: boolean) {
  await ensureLoggedByDriverColumn();
  const { rows } = hasSales
    ? await sql`
      SELECT
        b.id, b.barcode, b.serial_number, b.sold_at, b.cost,
        COALESCE(b.is_warranty, false) AS is_warranty,
        COALESCE(s.towbook_call_number, b.sold_on_call_number, sm.call_reference) AS call_number,
        s.quickbooks_invoice_id, s.sale_amount,
        COALESCE(mdl.code, NULL) AS model_code,
        COALESCE(bt.code, bt.name) AS type_code,
        l.name AS location_name,
        sm.driver_id,
        COALESCE(d.name, NULL) AS driver_name,
        COALESCE(ld.name, NULL) AS logged_by_name,
        t.truck_number,
        CASE
          WHEN retmv.occurred_at IS NOT NULL OR COALESCE(cr.has_returned, false) THEN 'returned'
          WHEN COALESCE(cr.has_kept, false) THEN 'customer_kept'
          ELSE 'owed'
        END AS core_status
      FROM batteries b
      JOIN companies c ON c.id = b.company_id
      LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
      LEFT JOIN battery_types bt ON bt.id = b.battery_type_id
      LEFT JOIN locations l ON l.id = b.location_id
      LEFT JOIN LATERAL (
        SELECT m.driver_id, m.from_truck_id, m.call_reference, m.logged_by_driver_id
        FROM battery_movements m
        WHERE m.battery_id = b.id AND m.to_status = 'sold'
        ORDER BY m.occurred_at DESC
        LIMIT 1
      ) sm ON true
      LEFT JOIN drivers d ON d.id = sm.driver_id
      LEFT JOIN drivers ld ON ld.id = sm.logged_by_driver_id
      LEFT JOIN trucks t ON t.id = sm.from_truck_id
      LEFT JOIN LATERAL (
        SELECT sale_amount, quickbooks_invoice_id, towbook_call_number
        FROM sales s2
        WHERE s2.battery_id = b.id
        ORDER BY s2.sold_at DESC NULLS LAST
        LIMIT 1
      ) s ON true
      LEFT JOIN LATERAL (
        SELECT
          bool_or(
            c.status = 'returned'
            AND COALESCE(c.returned_at, ${asOfIso}::timestamptz) < ${asOfIso}::timestamptz
          ) AS has_returned,
          bool_or(
            c.status = 'customer_kept'
            AND (c.returned_at IS NULL OR c.returned_at < ${asOfIso}::timestamptz)
          ) AS has_kept
        FROM core_returns c WHERE c.battery_id = b.id
      ) cr ON true
      LEFT JOIN LATERAL (
        SELECT mm.occurred_at
        FROM battery_movements mm
        WHERE mm.battery_id = b.id
          AND mm.to_status = 'returned_core'
          AND mm.occurred_at < ${asOfIso}::timestamptz
        ORDER BY mm.occurred_at DESC, mm.id DESC
        LIMIT 1
      ) retmv ON true
      WHERE c.org_id = ${orgId}
        AND b.sold_at IS NOT NULL
        AND b.sold_at >= ${startIso}::timestamptz
        AND b.sold_at < ${endIso}::timestamptz
      ORDER BY b.sold_at ASC, b.barcode`
    : await sql`
      SELECT
        b.id, b.barcode, b.serial_number, b.sold_at, b.cost,
        COALESCE(b.is_warranty, false) AS is_warranty,
        COALESCE(b.sold_on_call_number, sm.call_reference) AS call_number,
        NULL::text AS quickbooks_invoice_id, NULL::numeric AS sale_amount,
        COALESCE(mdl.code, NULL) AS model_code,
        COALESCE(bt.code, bt.name) AS type_code,
        l.name AS location_name,
        sm.driver_id,
        COALESCE(d.name, NULL) AS driver_name,
        COALESCE(ld.name, NULL) AS logged_by_name,
        t.truck_number,
        CASE
          WHEN retmv.occurred_at IS NOT NULL OR COALESCE(cr.has_returned, false) THEN 'returned'
          WHEN COALESCE(cr.has_kept, false) THEN 'customer_kept'
          ELSE 'owed'
        END AS core_status
      FROM batteries b
      JOIN companies c ON c.id = b.company_id
      LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
      LEFT JOIN battery_types bt ON bt.id = b.battery_type_id
      LEFT JOIN locations l ON l.id = b.location_id
      LEFT JOIN LATERAL (
        SELECT m.driver_id, m.from_truck_id, m.call_reference, m.logged_by_driver_id
        FROM battery_movements m
        WHERE m.battery_id = b.id AND m.to_status = 'sold'
        ORDER BY m.occurred_at DESC
        LIMIT 1
      ) sm ON true
      LEFT JOIN drivers d ON d.id = sm.driver_id
      LEFT JOIN drivers ld ON ld.id = sm.logged_by_driver_id
      LEFT JOIN trucks t ON t.id = sm.from_truck_id
      LEFT JOIN LATERAL (
        SELECT
          bool_or(
            c.status = 'returned'
            AND COALESCE(c.returned_at, ${asOfIso}::timestamptz) < ${asOfIso}::timestamptz
          ) AS has_returned,
          bool_or(
            c.status = 'customer_kept'
            AND (c.returned_at IS NULL OR c.returned_at < ${asOfIso}::timestamptz)
          ) AS has_kept
        FROM core_returns c WHERE c.battery_id = b.id
      ) cr ON true
      LEFT JOIN LATERAL (
        SELECT mm.occurred_at
        FROM battery_movements mm
        WHERE mm.battery_id = b.id
          AND mm.to_status = 'returned_core'
          AND mm.occurred_at < ${asOfIso}::timestamptz
        ORDER BY mm.occurred_at DESC, mm.id DESC
        LIMIT 1
      ) retmv ON true
      WHERE c.org_id = ${orgId}
        AND b.sold_at IS NOT NULL
        AND b.sold_at >= ${startIso}::timestamptz
        AND b.sold_at < ${endIso}::timestamptz
      ORDER BY b.sold_at ASC, b.barcode`;

  const items = rows.map((r) => ({
    time: iso(r.sold_at),
    timeLocal: formatLocal(r.sold_at, timeZone),
    barcode: String(r.barcode || ""),
    serialNumber: (r.serial_number as string) || null,
    model: (r.model_code as string) || null,
    type: (r.type_code as string) || null,
    qty: 1,
    location: (r.location_name as string) || null,
    truck: (r.truck_number as string) || null,
    driver: (r.driver_name as string) || null,
    loggedBy: (r.logged_by_name as string) || null,
    callNumber: (r.call_number as string) || null,
    invoiceNumber: (r.quickbooks_invoice_id as string) || null,
    // saleAmount is retail only when a sales-table row exists (often unused).
    // wholesaleCost is batteries.cost, the figure other reports already use.
    saleAmount: money(r.sale_amount),
    wholesaleCost: r.is_warranty ? 0 : money(r.cost),
    isWarranty: !!r.is_warranty,
    coreStatus: (r.core_status as string) || "owed",
  }));
  return {
    count: items.length,
    items,
    byLocation: countBy(items, "location"),
    byTruck: countBy(items, "truck"),
    byDriver: countBy(items.map((i) => ({ ...i, driver: i.driver || "Unassigned" })), "driver"),
  };
}

async function coresForOrg(orgId: string, startIso: string, endIso: string, asOfIso: string, timeZone: string, soldItems: { barcode: string; time: string | null; timeLocal: string | null; model: string | null; type: string | null; location: string | null; truck: string | null; driver: string | null; callNumber: string | null; coreStatus: string; isWarranty: boolean }[]) {
  const collectedItems = soldItems.map((s) => ({
    time: s.time,
    timeLocal: s.timeLocal,
    barcode: s.barcode,
    serialNumber: null as string | null,
    model: s.model,
    type: s.type,
    qty: 1,
    location: s.location,
    truck: s.truck,
    driver: s.driver,
    callNumber: s.callNumber,
    coreStatus: s.coreStatus,
    isWarranty: s.isWarranty,
  }));

  const { rows: pendingRows } = await sql`
    WITH sold AS (
      SELECT b.id, b.barcode, b.status::text AS status,
             COALESCE(b.is_warranty, false) AS is_warranty,
             b.sold_at, b.sold_on_call_number, b.battery_model_id, b.location_id, b.battery_type_id
      FROM batteries b
      JOIN companies c ON c.id = b.company_id
      WHERE c.org_id = ${orgId}
        AND (b.status IN ('sold', 'returned_core')
             OR EXISTS (SELECT 1 FROM battery_movements m
                        WHERE m.battery_id = b.id AND m.to_status = 'sold'))
        AND b.sold_at IS NOT NULL
    )
    SELECT
      s.barcode,
      s.sold_at,
      s.sold_on_call_number AS call_number,
      s.is_warranty,
      COALESCE(d.name, NULL) AS driver_name,
      t.truck_number,
      COALESCE(mdl.code, NULL) AS model_code,
      COALESCE(bt.code, bt.name) AS type_code,
      COALESCE(l.name, NULL) AS location_name,
      CASE
        WHEN retmv.occurred_at IS NOT NULL OR COALESCE(cr.has_returned, false) THEN 'returned'
        WHEN COALESCE(cr.has_kept, false) THEN 'customer_kept'
        ELSE 'owed'
      END AS core_status
    FROM sold s
    LEFT JOIN LATERAL (
      SELECT m.driver_id, m.from_truck_id FROM battery_movements m
      WHERE m.battery_id = s.id AND m.to_status = 'sold'
      ORDER BY m.occurred_at DESC LIMIT 1
    ) sm ON true
    LEFT JOIN trucks t ON t.id = sm.from_truck_id
    LEFT JOIN LATERAL (
      SELECT bool_or(
               c.status = 'returned'
               AND COALESCE(c.returned_at, ${asOfIso}::timestamptz) < ${asOfIso}::timestamptz
             ) AS has_returned,
             bool_or(
               c.status = 'customer_kept'
               AND (c.returned_at IS NULL OR c.returned_at < ${asOfIso}::timestamptz)
             ) AS has_kept
      FROM core_returns c WHERE c.battery_id = s.id
    ) cr ON true
    LEFT JOIN LATERAL (
      SELECT mm.occurred_at
      FROM battery_movements mm
      WHERE mm.battery_id = s.id
        AND mm.to_status = 'returned_core'
        AND mm.occurred_at < ${asOfIso}::timestamptz
      ORDER BY mm.occurred_at DESC, mm.id DESC
      LIMIT 1
    ) retmv ON true
    LEFT JOIN drivers d ON d.id = sm.driver_id
    LEFT JOIN battery_models mdl ON mdl.id = s.battery_model_id
    LEFT JOIN battery_types bt ON bt.id = s.battery_type_id
    LEFT JOIN locations l ON l.id = s.location_id
    WHERE s.sold_at < ${asOfIso}::timestamptz
      AND retmv.occurred_at IS NULL
      AND NOT COALESCE(cr.has_returned, false)
      AND NOT COALESCE(cr.has_kept, false)
    ORDER BY s.sold_at ASC NULLS LAST, s.barcode`;

  const asOfMs = Date.parse(asOfIso);
  const agedCutoff = new Date(asOfMs - 7 * 24 * 60 * 60 * 1000);
  const pendingItems = pendingRows
    .filter((r) => r.core_status === "owed")
    .map((r) => {
      const soldAt = r.sold_at ? new Date(String(r.sold_at)) : null;
      const ageDays = soldAt && !Number.isNaN(soldAt.getTime())
        ? Math.floor((asOfMs - 1 - soldAt.getTime()) / (24 * 60 * 60 * 1000))
        : null;
      return {
        time: iso(r.sold_at),
        timeLocal: formatLocal(r.sold_at, timeZone),
        barcode: String(r.barcode || ""),
        serialNumber: null as string | null,
        model: (r.model_code as string) || null,
        type: (r.type_code as string) || null,
        qty: 1,
        location: (r.location_name as string) || null,
        truck: (r.truck_number as string) || null,
        driver: (r.driver_name as string) || null,
        callNumber: (r.call_number as string) || null,
        coreStatus: "owed" as const,
        isWarranty: !!r.is_warranty,
        ageDays,
        agedOver7Days: !!(soldAt && soldAt < agedCutoff),
      };
    });

  const { rows: returnedRows } = await sql`
    SELECT
      COALESCE(cr.returned_at, m.occurred_at) AS returned_at,
      b.barcode,
      b.serial_number,
      COALESCE(mdl.code, NULL) AS model_code,
      COALESCE(bt.code, bt.name) AS type_code,
      l.name AS location_name,
      COALESCE(t.truck_number, ts.truck_number) AS truck_number,
      COALESCE(d.name, ds.name) AS driver_name,
      cr.status,
      cr.deposit_amount,
      cr.refund_amount,
      cr.notes
    FROM batteries b
    JOIN companies c ON c.id = b.company_id
    LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
    LEFT JOIN battery_types bt ON bt.id = b.battery_type_id
    LEFT JOIN locations l ON l.id = b.location_id
    LEFT JOIN core_returns cr ON cr.battery_id = b.id AND cr.status = 'returned'
    LEFT JOIN LATERAL (
      SELECT mm.occurred_at, mm.driver_id, mm.from_truck_id
      FROM battery_movements mm
      WHERE mm.battery_id = b.id AND mm.to_status = 'returned_core'
      ORDER BY mm.occurred_at DESC LIMIT 1
    ) m ON true
    LEFT JOIN drivers d ON d.id = m.driver_id
    LEFT JOIN trucks t ON t.id = m.from_truck_id
    LEFT JOIN LATERAL (
      SELECT mm.driver_id, mm.from_truck_id FROM battery_movements mm
      WHERE mm.battery_id = b.id AND mm.to_status = 'sold'
      ORDER BY mm.occurred_at DESC LIMIT 1
    ) sm ON true
    LEFT JOIN drivers ds ON ds.id = sm.driver_id
    LEFT JOIN trucks ts ON ts.id = sm.from_truck_id
    WHERE c.org_id = ${orgId}
      AND (
        (cr.returned_at IS NOT NULL AND cr.returned_at >= ${startIso}::timestamptz AND cr.returned_at < ${endIso}::timestamptz)
        OR (m.occurred_at IS NOT NULL AND m.occurred_at >= ${startIso}::timestamptz AND m.occurred_at < ${endIso}::timestamptz)
      )
    ORDER BY returned_at ASC, b.barcode`;

  const returnedItems = rowsToUniqueByBarcode(returnedRows, "returned_at").map((r) => ({
    time: iso(r.returned_at),
    timeLocal: formatLocal(r.returned_at, timeZone),
    barcode: String(r.barcode || ""),
    serialNumber: (r.serial_number as string) || null,
    model: (r.model_code as string) || null,
    type: (r.type_code as string) || null,
    qty: 1,
    location: (r.location_name as string) || null,
    truck: (r.truck_number as string) || null,
    driver: (r.driver_name as string) || null,
    coreStatus: "returned",
    depositAmount: money(r.deposit_amount),
    refundAmount: money(r.refund_amount),
    notes: (r.notes as string) || null,
  }));

  const creditedItems: MovementItem[] = [];

  const { rows: refundRows } = await sql`
    SELECT
      cr.refunded_at, b.barcode, b.serial_number,
      COALESCE(mdl.code, NULL) AS model_code,
      COALESCE(bt.code, bt.name) AS type_code,
      l.name AS location_name,
      cr.status, cr.deposit_amount, cr.refund_amount, cr.notes
    FROM core_returns cr
    JOIN batteries b ON b.id = cr.battery_id
    JOIN companies c ON c.id = b.company_id
    LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
    LEFT JOIN battery_types bt ON bt.id = b.battery_type_id
    LEFT JOIN locations l ON l.id = b.location_id
    WHERE c.org_id = ${orgId}
      AND cr.refunded_at IS NOT NULL
      AND cr.refunded_at >= ${startIso}::timestamptz
      AND cr.refunded_at < ${endIso}::timestamptz
    ORDER BY cr.refunded_at ASC`;
  for (const r of refundRows) {
    creditedItems.push({
      time: iso(r.refunded_at),
      timeLocal: formatLocal(r.refunded_at, timeZone),
      barcode: String(r.barcode || ""),
      serialNumber: (r.serial_number as string) || null,
      model: (r.model_code as string) || null,
      type: (r.type_code as string) || null,
      qty: 1,
      location: (r.location_name as string) || null,
      truck: null,
      kind: "refund",
      depositAmount: money(r.deposit_amount),
      refundAmount: money(r.refund_amount),
      notes: (r.notes as string) || null,
    });
  }

  if (await tableExists("warranty_credit_memos")) {
    const { rows: memoRows } = await sql`
      SELECT
        m.memo_date, m.memo_number, m.core_credits, m.warranty_count,
        l.name AS location_name, m.notes
      FROM warranty_credit_memos m
      JOIN companies c ON c.id = m.company_id
      LEFT JOIN locations l ON l.id = m.location_id
      WHERE c.org_id = ${orgId}
        AND m.memo_date >= ${startIso}::timestamptz
        AND m.memo_date < ${endIso}::timestamptz
      ORDER BY m.memo_date ASC`;
    for (const r of memoRows) {
      creditedItems.push({
        time: iso(r.memo_date),
        timeLocal: formatLocal(r.memo_date, timeZone),
        barcode: (r.memo_number as string) || "warranty-credit-memo",
        serialNumber: null,
        model: null,
        type: null,
        qty: Number(r.warranty_count) || 1,
        location: (r.location_name as string) || null,
        truck: null,
        kind: "warranty_memo",
        creditAmount: money(r.core_credits),
        notes: (r.notes as string) || null,
      });
    }
  }

  if (await tableExists("delivery_receipts")) {
    const { rows: recRows } = await sql`
      SELECT
        dr.receipt_date, dr.receipt_number, dr.supplier, dr.po_number,
        dr.core_credits, l.name AS location_name, dr.notes
      FROM delivery_receipts dr
      JOIN companies c ON c.id = dr.company_id
      LEFT JOIN locations l ON l.id = dr.location_id
      WHERE c.org_id = ${orgId}
        AND COALESCE(dr.core_credits, 0) > 0
        AND dr.receipt_date >= ${startIso}::timestamptz
        AND dr.receipt_date < ${endIso}::timestamptz
      ORDER BY dr.receipt_date ASC`;
    for (const r of recRows) {
      creditedItems.push({
        time: iso(r.receipt_date),
        timeLocal: formatLocal(r.receipt_date, timeZone),
        barcode: (r.receipt_number as string) || "delivery-credit",
        serialNumber: null,
        model: null,
        type: null,
        qty: 1,
        location: (r.location_name as string) || null,
        truck: null,
        kind: "delivery_credit",
        supplier: (r.supplier as string) || null,
        poNumber: (r.po_number as string) || null,
        creditAmount: money(r.core_credits),
        notes: (r.notes as string) || null,
      });
    }
  }

  const aged = pendingItems.filter((p) => p.agedOver7Days);
  return {
    collected: {
      count: collectedItems.length,
      items: collectedItems,
    },
    pending: {
      count: pendingItems.length,
      agedOver7Days: aged.length,
      items: pendingItems,
      agedItems: aged,
      byLocation: countBy(pendingItems, "location"),
      byTruck: countBy(pendingItems, "truck"),
    },
    returned: {
      count: returnedItems.length,
      items: returnedItems,
    },
    credited: {
      count: creditedItems.length,
      items: creditedItems,
    },
  };
}

function rowsToUniqueByBarcode(rows: Record<string, unknown>[], timeKey: string) {
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  for (const r of rows) {
    const key = String(r.barcode || r.id || Math.random());
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

async function transfersForOrg(orgId: string, startIso: string, endIso: string, timeZone: string) {
  const { rows } = await sql`
    SELECT
      m.occurred_at,
      m.from_status, m.to_status,
      m.notes,
      b.barcode, b.serial_number,
      COALESCE(mdl.code, NULL) AS model_code,
      COALESCE(bt.code, bt.name) AS type_code,
      fl.name AS from_location,
      tl.name AS to_location,
      ft.truck_number AS from_truck,
      tt.truck_number AS to_truck,
      COALESCE(d.name, rec.name) AS actor_name
    FROM battery_movements m
    JOIN batteries b ON b.id = m.battery_id
    JOIN companies c ON c.id = b.company_id
    LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
    LEFT JOIN battery_types bt ON bt.id = b.battery_type_id
    LEFT JOIN locations fl ON fl.id = m.from_location_id
    LEFT JOIN locations tl ON tl.id = m.to_location_id
    LEFT JOIN trucks ft ON ft.id = m.from_truck_id
    LEFT JOIN trucks tt ON tt.id = m.to_truck_id
    LEFT JOIN drivers d ON d.id = m.driver_id
    LEFT JOIN users rec ON rec.id = m.recorded_by_id
    WHERE c.org_id = ${orgId}
      AND m.occurred_at >= ${startIso}::timestamptz
      AND m.occurred_at < ${endIso}::timestamptz
      AND NOT (
        (m.from_status IS NULL AND m.to_status = 'in_warehouse')
        OR m.to_status = 'sold'
        OR m.to_status = 'returned_core'
      )
      AND (
        m.from_truck_id IS DISTINCT FROM m.to_truck_id
        OR m.from_location_id IS DISTINCT FROM m.to_location_id
        OR (m.from_status = 'in_warehouse' AND m.to_status = 'on_truck')
        OR (m.from_status = 'on_truck' AND m.to_status = 'in_warehouse')
        OR (m.from_status = 'on_truck' AND m.to_status = 'on_truck')
      )
    ORDER BY m.occurred_at ASC, b.barcode`;

  const items = rows.map((r) => {
    const fromLoc = (r.from_location as string) || null;
    const toLoc = (r.to_location as string) || null;
    const fromTruck = (r.from_truck as string) || null;
    const toTruck = (r.to_truck as string) || null;
    let kind = "transfer";
    if (r.from_status === "in_warehouse" && r.to_status === "on_truck") kind = "load_to_truck";
    else if (r.from_status === "on_truck" && r.to_status === "in_warehouse") kind = "return_to_warehouse";
    else if (r.from_status === "on_truck" && r.to_status === "on_truck") kind = "truck_to_truck";
    else if (fromLoc && toLoc && fromLoc !== toLoc) kind = "location_to_location";
    return {
      time: iso(r.occurred_at),
      timeLocal: formatLocal(r.occurred_at, timeZone),
      barcode: String(r.barcode || ""),
      serialNumber: (r.serial_number as string) || null,
      model: (r.model_code as string) || null,
      type: (r.type_code as string) || null,
      qty: 1,
      location: toLoc || fromLoc,
      truck: toTruck || fromTruck,
      kind,
      fromLocation: fromLoc,
      toLocation: toLoc,
      fromTruck,
      toTruck,
      fromStatus: (r.from_status as string) || null,
      toStatus: (r.to_status as string) || null,
      actor: (r.actor_name as string) || null,
      notes: (r.notes as string) || null,
    };
  });
  return { count: items.length, items };
}

async function inventoryForOrg(orgId: string, asOfIso: string) {
  const { rows } = await sql`
    SELECT
      l.name AS location_name,
      t.truck_number,
      COALESCE(mdl.code, bt.code, bt.name, 'Unknown') AS size_code,
      COALESCE(asof.to_status, 'in_warehouse')::text AS status,
      COUNT(*)::int AS n
    FROM batteries b
    JOIN companies c ON c.id = b.company_id
    LEFT JOIN LATERAL (
      SELECT mm.to_status, mm.to_truck_id, mm.to_location_id
      FROM battery_movements mm
      WHERE mm.battery_id = b.id
        AND mm.occurred_at < ${asOfIso}::timestamptz
      ORDER BY mm.occurred_at DESC, mm.id DESC
      LIMIT 1
    ) asof ON true
    LEFT JOIN locations l ON l.id = COALESCE(asof.to_location_id, b.location_id)
    LEFT JOIN trucks t ON t.id = asof.to_truck_id
    LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
    LEFT JOIN battery_types bt ON bt.id = b.battery_type_id
    WHERE c.org_id = ${orgId}
      AND COALESCE(b.received_at, b.created_at) < ${asOfIso}::timestamptz
      AND COALESCE(asof.to_status, 'in_warehouse') IN ('in_warehouse', 'on_truck')
    GROUP BY l.name, t.truck_number, COALESCE(mdl.code, bt.code, bt.name, 'Unknown'), COALESCE(asof.to_status, 'in_warehouse')
    ORDER BY l.name NULLS LAST, t.truck_number NULLS LAST, size_code`;

  const byLocation = new Map<string, number>();
  const bySize = new Map<string, number>();
  const byTruck = new Map<string, { truck: string; location: string; count: number }>();
  const byLocationAndSize: { location: string; size: string; count: number }[] = [];
  const locSize = new Map<string, number>();
  let inWarehouse = 0;
  let onTruck = 0;
  let total = 0;
  for (const r of rows) {
    const n = Number(r.n) || 0;
    const loc = (r.location_name as string) || "Unassigned";
    const size = (r.size_code as string) || "Unknown";
    const truck = (r.truck_number as string) || null;
    total += n;
    if (r.status === "in_warehouse") inWarehouse += n;
    if (r.status === "on_truck") onTruck += n;
    byLocation.set(loc, (byLocation.get(loc) || 0) + n);
    bySize.set(size, (bySize.get(size) || 0) + n);
    locSize.set(`${loc}\t${size}`, (locSize.get(`${loc}\t${size}`) || 0) + n);
    if (truck) {
      const k = `${truck}\t${loc}`;
      const cur = byTruck.get(k) || { truck, location: loc, count: 0 };
      cur.count += n;
      byTruck.set(k, cur);
    }
  }
  for (const [k, count] of locSize) {
    const [location, size] = k.split("\t");
    byLocationAndSize.push({ location, size, count });
  }
  byLocationAndSize.sort((a, b) => a.location.localeCompare(b.location) || b.count - a.count);
  return {
    total,
    inWarehouse,
    onTruck,
    note: "Available-to-sell stock (in_warehouse or on_truck) as of the report instant: end of the report day in the org timezone, or now if that day is still in progress. Grouped by battery model/size, not by family (AGM/Alpha/Bravo).",
    byLocation: [...byLocation.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    bySize: [...bySize.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    byLocationAndSize,
    byTruck: [...byTruck.values()].sort((a, b) => b.count - a.count || a.truck.localeCompare(b.truck)),
  };
}

export async function buildOrgDailyReport(org: ReportOrg, dateYmd: string) {
  const settings = await getOrgSettings(org.id);
  const timeZone = settings.timezone || "America/Phoenix";
  const { start, end } = zonedDayRange(dateYmd, timeZone);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const asOf = asOfInstant(end);
  const asOfIso = asOf.toISOString();
  const dayIsOpen = asOf.getTime() < end.getTime();
  const hasSales = await tableExists("sales");

  const incoming = await incomingForOrg(org.id, startIso, endIso, asOfIso, timeZone);
  const sold = await soldForOrg(org.id, startIso, endIso, asOfIso, timeZone, hasSales);
  const cores = await coresForOrg(org.id, startIso, endIso, asOfIso, timeZone, sold.items);
  const transfers = await transfersForOrg(org.id, startIso, endIso, timeZone);
  const inventory = await inventoryForOrg(org.id, asOfIso);

  return {
    org,
    timezone: timeZone,
    date: dateYmd,
    range: {
      start: startIso,
      end: endIso,
      startLocal: formatLocal(start, timeZone),
      endLocal: formatLocal(end, timeZone),
      asOf: asOfIso,
      asOfLocal: formatLocal(asOf, timeZone),
      snapshot: dayIsOpen ? "as_of_now" : "end_of_day",
    },
    notes: [
      "Incoming, sold, transfers, and core returns are events during this calendar day in the org timezone.",
      "Cores collected is one row per sale that day (including warranty). A customer_kept status means no core is coming back.",
      "Cores returned are cores physically returned that day, including cores from earlier sales.",
      "Cores pending and available stock are snapshots as of the end of the day, or as of now if the day is still in progress. They are not live totals taken at report run time on a later day.",
    ],
    incoming,
    sold,
    cores,
    transfers,
    inventory,
  };
}

export async function buildDailyMovementsReport(opts: {
  orgParam: string | null;
  dateYmd: string | null;
  includeDemo?: boolean;
}) {
  const resolved = await resolveReportOrgs(opts.orgParam, !!opts.includeDemo);
  if (resolved.error) return { ok: false as const, error: resolved.error, status: 404 };
  if (!resolved.orgs.length) {
    return { ok: false as const, error: "No organizations found.", status: 404 };
  }

  const reports = [];
  for (const org of resolved.orgs) {
    const settings = await getOrgSettings(org.id);
    const timeZone = settings.timezone || "America/Phoenix";
    const dateYmd = opts.dateYmd || addDaysYmd(todayYmd(timeZone), -1);
    reports.push(await buildOrgDailyReport(org, dateYmd));
  }

  return {
    ok: true as const,
    generatedAt: new Date().toISOString(),
    orgs: resolved.orgs,
    reports,
  };
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function dailyMovementsToCsv(payload: Awaited<ReturnType<typeof buildDailyMovementsReport>> & { ok: true }): string {
  const lines: string[] = [];
  const header = [
    "org_slug", "org_name", "date", "section", "time_local", "barcode", "serial",
    "model", "type", "qty", "location", "truck", "driver_or_actor", "logged_by", "call_or_invoice",
    "core_status", "amount", "notes",
  ];
  lines.push(header.join(","));

  const push = (orgSlug: string, orgName: string, date: string, section: string, item: Record<string, unknown>) => {
    lines.push([
      orgSlug, orgName, date, section,
      item.timeLocal, item.barcode, item.serialNumber, item.model, item.type,
      item.qty ?? 1, item.location, item.truck,
      item.driver || item.actor || item.receivedBy || "",
      item.loggedBy || "",
      item.callNumber || item.invoiceNumber || item.receiptNumber || item.poNumber || "",
      item.coreStatus || item.kind || "",
      item.saleAmount ?? item.wholesaleCost ?? item.refundAmount ?? item.creditAmount ?? "",
      item.notes || item.supplier || "",
    ].map(csvEscape).join(","));
  };

  for (const r of payload.reports) {
    const slug = r.org.slug;
    const name = r.org.name;
    const date = r.date;
    for (const it of r.incoming.items) push(slug, name, date, "incoming", it);
    for (const it of r.sold.items) push(slug, name, date, "sold", it);
    for (const it of r.cores.collected.items) push(slug, name, date, "cores_collected", it);
    for (const it of r.cores.pending.items) push(slug, name, date, "cores_pending", it);
    for (const it of r.cores.returned.items) push(slug, name, date, "cores_returned", it);
    for (const it of r.cores.credited.items) push(slug, name, date, "cores_credited", it);
    for (const it of r.transfers.items) push(slug, name, date, "transfer", it);
    for (const it of r.inventory.byLocationAndSize) {
      push(slug, name, date, "inventory_available", {
        timeLocal: "",
        barcode: "",
        serialNumber: "",
        model: it.size,
        type: "",
        qty: it.count,
        location: it.location,
        truck: "",
        notes: "available-to-sell",
      });
    }
  }
  return lines.join("\n") + "\n";
}
