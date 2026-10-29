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
  driver_id: string | null;
  driver_name: string;
  model_code: string;
  location_name: string;
  core_state: CoreState;
}

export async function getCoreLedger(
  orgId: string,
  from: string | null = null,
  to: string | null = null
): Promise<CoreLedgerRow[]> {
  const { rows } = await sql`
    WITH sold AS (
      SELECT b.id, b.barcode, b.status::text AS status,
             COALESCE(b.is_warranty, false) AS is_warranty,
             b.sold_at, b.battery_model_id, b.location_id
      FROM batteries b
      WHERE b.company_id IN (SELECT id FROM companies WHERE org_id = ${orgId})
        AND (b.status IN ('sold', 'returned_core')
             OR EXISTS (SELECT 1 FROM battery_movements m
                        WHERE m.battery_id = b.id AND m.to_status = 'sold'))
        AND (${from}::timestamp IS NULL OR b.sold_at >= ${from}::timestamp)
        AND (${to}::timestamp   IS NULL OR b.sold_at <  (${to}::timestamp + INTERVAL '1 day'))
    )
    SELECT
      s.id AS battery_id,
      s.barcode,
      s.is_warranty,
      s.sold_at,
      sm.driver_id,
      COALESCE(d.name, 'Unknown driver') AS driver_name,
      COALESCE(mdl.code, 'Unknown model') AS model_code,
      COALESCE(l.name, 'Unknown location') AS location_name,
      CASE
        WHEN s.status = 'returned_core' OR cr.has_returned THEN 'returned'
        WHEN cr.has_kept THEN 'customer_kept'
        ELSE 'owed'
      END AS core_state
    FROM sold s
    LEFT JOIN LATERAL (
      SELECT m.driver_id FROM battery_movements m
      WHERE m.battery_id = s.id AND m.to_status = 'sold'
      ORDER BY m.occurred_at DESC LIMIT 1
    ) sm ON true
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
