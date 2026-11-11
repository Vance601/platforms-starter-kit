// Reassign every row that points at a location, then drop or hide the location.
// Used by /api/locations/delete. Scoped by the caller; this helper only runs
// updates against IDs the route has already tenant-checked.
import { sql } from "@vercel/postgres";

export type LocationRef = { table: string; column: string; count: number };

const KNOWN_REFS: Array<[string, string]> = [
  ["batteries", "location_id"],
  ["trucks", "location_id"],
  ["users", "home_location_id"],
  ["battery_movements", "from_location_id"],
  ["battery_movements", "to_location_id"],
  ["mbs_invoices", "location_id"],
  ["sales", "location_id"],
  ["core_returns", "location_id"],
  ["delivery_receipts", "location_id"],
  ["warranty_pickups", "location_id"],
  ["warranty_credit_memos", "location_id"],
  ["drivers", "location_id"],
  ["drivers", "home_location_id"],
];

function ident(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Unexpected identifier: ${name}`);
  }
  return name;
}

async function existingColumns(): Promise<Array<[string, string]>> {
  const { rows } = await sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN (
        'location_id', 'from_location_id', 'to_location_id',
        'home_location_id', 'default_location_id'
      )
    ORDER BY table_name, column_name;`;
  const found = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
  const out: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const [t, c] of KNOWN_REFS) {
    const k = `${t}.${c}`;
    if (found.has(k) && !seen.has(k)) {
      out.push([t, c]);
      seen.add(k);
    }
  }
  for (const r of rows) {
    const t = String(r.table_name);
    const c = String(r.column_name);
    if (t === "locations") continue;
    const k = `${t}.${c}`;
    if (!seen.has(k)) {
      out.push([t, c]);
      seen.add(k);
    }
  }
  return out;
}

export async function countLocationRefs(locationId: string): Promise<LocationRef[]> {
  const cols = await existingColumns();
  const refs: LocationRef[] = [];
  for (const [table, column] of cols) {
    const { rows } = await sql.query(
      `SELECT COUNT(*)::int AS n FROM "${ident(table)}" WHERE "${ident(column)}"::text = $1`,
      [locationId],
    );
    refs.push({ table, column, count: Number(rows[0]?.n || 0) });
  }
  return refs;
}

export async function reassignLocationRefs(
  fromId: string,
  toId: string,
): Promise<LocationRef[]> {
  const cols = await existingColumns();
  const moved: LocationRef[] = [];
  for (const [table, column] of cols) {
    const { rowCount } = await sql.query(
      `UPDATE "${ident(table)}" SET "${ident(column)}" = $1 WHERE "${ident(column)}"::text = $2`,
      [toId, fromId],
    );
    const n = rowCount ?? 0;
    if (n) moved.push({ table, column, count: n });
  }
  return moved;
}

export function refsTotal(refs: LocationRef[]): number {
  return refs.reduce((s, r) => s + r.count, 0);
}
