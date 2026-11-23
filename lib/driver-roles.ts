import { sql } from "@vercel/postgres";
import { resolveDuggersOrg } from "@/lib/duggers-inventory-reset";

export const SELL_WAREHOUSE_HELP =
  "Moving batteries to a truck? Use Transfer. Recording a sale for a driver? Pick the driver.";

const CHRIS_WAREHOUSE_SEED_KEY = "duggers_chris_roudabush_warehouse_v1";

let ensurePromise: Promise<void> | null = null;

function truthyFlag(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === "TRUE" || value === 1;
}

/** Normalize a driver display name for matching (trim + collapse space + casefold). */
export function normalizeDriverName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isChrisRoudabushName(name: string): boolean {
  return normalizeDriverName(name) === "chris roudabush";
}

/**
 * Decide who gets sale credit.
 * Warehouse staff (and anyone selling a battery that is not on a truck they
 * currently hold) must pick the selling driver. That driver is stored on the
 * sold movement; the session user is only the person who logged it.
 */
export function resolveSaleSeller(opts: {
  sessionDriverId: string;
  isWarehouse: boolean;
  claimedTruckId: string | null;
  batteryTruckId: string | null;
  soldByDriverId: string | null | undefined;
}): { ok: true; sellerId: string; requiresPick: boolean } | { ok: false; error: string } {
  const claimedMatches =
    !!opts.claimedTruckId &&
    !!opts.batteryTruckId &&
    opts.claimedTruckId === opts.batteryTruckId;

  if (!opts.isWarehouse && claimedMatches) {
    return { ok: true, sellerId: opts.sessionDriverId, requiresPick: false };
  }

  const picked = (opts.soldByDriverId || "").trim();
  if (!picked) {
    return { ok: false, error: SELL_WAREHOUSE_HELP };
  }
  if (opts.isWarehouse && picked === opts.sessionDriverId) {
    return { ok: false, error: SELL_WAREHOUSE_HELP };
  }
  return { ok: true, sellerId: picked, requiresPick: true };
}

export async function ensureDriverWarehouseFlag(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await sql`
        ALTER TABLE drivers
        ADD COLUMN IF NOT EXISTS is_warehouse BOOLEAN NOT NULL DEFAULT FALSE;
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS schema_flags (
          key TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;
      await seedChrisWarehouseRole();
    })().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  return ensurePromise;
}

/**
 * One-time, idempotent seed: mark Chris Roudabush as warehouse staff in the
 * Duggers org only. A schema_flags row prevents re-applying if a manager later
 * clears the toggle. PINs are never read or changed.
 */
async function seedChrisWarehouseRole(): Promise<void> {
  const { rows: flagged } = await sql`
    SELECT 1 FROM schema_flags WHERE key = ${CHRIS_WAREHOUSE_SEED_KEY} LIMIT 1;
  `;
  if (flagged.length > 0) return;

  const dug = await resolveDuggersOrg();
  const dugOrgId = dug?.orgId ?? null;

  const { rows } = await sql`
    UPDATE drivers d
    SET is_warehouse = TRUE
    FROM companies c
    JOIN organizations o ON o.id = c.org_id
    WHERE d.company_id = c.id
      AND lower(regexp_replace(trim(d.name), '\\s+', ' ', 'g')) = 'chris roudabush'
      AND (
        lower(o.slug) = 'duggers'
        OR (${dugOrgId}::text IS NOT NULL AND o.id::text = ${dugOrgId}::text)
      )
      AND COALESCE(d.is_warehouse, FALSE) = FALSE
    RETURNING d.id;
  `;

  if (rows.length > 0) {
    await sql`
      INSERT INTO schema_flags (key) VALUES (${CHRIS_WAREHOUSE_SEED_KEY})
      ON CONFLICT (key) DO NOTHING;
    `;
  }
}

export async function ensureLoggedByDriverColumn(): Promise<void> {
  await sql`
    ALTER TABLE battery_movements
    ADD COLUMN IF NOT EXISTS logged_by_driver_id TEXT;
  `;
}

export async function getDriverRole(driverId: string): Promise<{
  id: string;
  name: string;
  companyId: string;
  orgId: string | null;
  isWarehouse: boolean;
  active: boolean;
} | null> {
  await ensureDriverWarehouseFlag();
  const { rows } = await sql`
    SELECT d.id, d.name, d.company_id, d.active, COALESCE(d.is_warehouse, FALSE) AS is_warehouse,
           c.org_id
    FROM drivers d
    LEFT JOIN companies c ON c.id = d.company_id
    WHERE d.id = ${driverId}
    LIMIT 1;
  `;
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: String(r.id),
    name: String(r.name || ""),
    companyId: String(r.company_id),
    orgId: r.org_id == null ? null : String(r.org_id),
    isWarehouse: truthyFlag(r.is_warehouse),
    active: r.active !== false,
  };
}

export { truthyFlag };
