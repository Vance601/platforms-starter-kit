import { sql } from "@vercel/postgres";

// SINGLE source of truth for "cores owed". Used by Battery Audit (/reconcile),
// Core Accountability and Driver Core Reconcile so the numbers always agree.
//
// Definition: every battery that has been SOLD (regular or warranty) carries
// one core. Its core state is:
//   - "returned"       battery.status = 'returned_core' OR core_returns.status = 'returned'
//   - "customer_kept"  core_returns.status = 'customer_kept' (charge collected, no core coming)
//   - "owed"           anything else
// Warehouse / on-truck stock never owes a core. Cores owed = sold - returned - kept.
export type CoreState = "owed" | "returned" | "customer_kept";

export interface CoreLedgerRow {
  battery_id: string;
  barcode: string;
  is_warranty: boolean;
  sold_at: string | null;
  sold_on_call_number: string | null;
  driver_id: string | null;
  driver_name: string;
  truck_id: string | null;
  truck_number: string | null;
  model_code: string;
  location_name: string;
  core_state: CoreState;
}

export async function getCoreLedger(
  orgId: string,
  fromIso: string | null = null,
  toIsoExclusive: string | null = null
): Promise<CoreLedgerRow[]> {
  const { rows } = await sql`
    WITH sold AS (
      SELECT b.id, b.barcode, b.status::text AS status,
             COALESCE(b.is_warranty, false) AS is_warranty,
             b.sold_at, b.sold_on_call_number, b.battery_model_id, b.location_id
      FROM batteries b
      WHERE b.company_id IN (SELECT id FROM companies WHERE org_id = ${orgId})
        AND (b.status IN ('sold', 'returned_core')
             OR EXISTS (SELECT 1 FROM battery_movements m
                        WHERE m.battery_id = b.id AND m.to_status = 'sold'))
        AND (${fromIso}::timestamptz IS NULL OR b.sold_at >= ${fromIso}::timestamptz)
        AND (${toIsoExclusive}::timestamptz IS NULL OR b.sold_at < ${toIsoExclusive}::timestamptz)
    )
    SELECT
      s.id AS battery_id,
      s.barcode,
      s.is_warranty,
      s.sold_at,
      s.sold_on_call_number,
      sm.driver_id,
      COALESCE(d.name, 'Unknown driver') AS driver_name,
      sm.from_truck_id AS truck_id,
      t.truck_number,
      COALESCE(mdl.code, 'Unknown model') AS model_code,
      COALESCE(l.name, 'Unknown location') AS location_name,
      CASE
        WHEN s.status = 'returned_core' OR cr.has_returned THEN 'returned'
        WHEN cr.has_kept THEN 'customer_kept'
        ELSE 'owed'
      END AS core_state
    FROM sold s
    LEFT JOIN LATERAL (
      SELECT m.driver_id, m.from_truck_id FROM battery_movements m
      WHERE m.battery_id = s.id AND m.to_status = 'sold'
      ORDER BY m.occurred_at DESC LIMIT 1
    ) sm ON true
    LEFT JOIN trucks t           ON t.id = sm.from_truck_id
    LEFT JOIN LATERAL (
      SELECT bool_or(c.status = 'returned') AS has_returned,
             bool_or(c.status = 'customer_kept') AS has_kept
      FROM core_returns c WHERE c.battery_id = s.id
    ) cr ON true
    LEFT JOIN drivers d          ON d.id = sm.driver_id
    LEFT JOIN battery_models mdl ON mdl.id = s.battery_model_id
    LEFT JOIN locations l        ON l.id = s.location_id;
  `;
  return rows as CoreLedgerRow[];
}

export function summarizeCores(rows: CoreLedgerRow[]) {
  const s = { sold: 0, regular: 0, warranty: 0, returned: 0, customer_kept: 0, owed: 0 };
  for (const r of rows) {
    s.sold++;
    if (r.is_warranty) s.warranty++;
    else s.regular++;
    if (r.core_state === "returned") s.returned++;
    else if (r.core_state === "customer_kept") s.customer_kept++;
    else s.owed++;
  }
  return s;
}
