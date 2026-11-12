import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { ensureDemoTables } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Removes expired DEMO orgs only (organizations.is_demo = true AND demo_expires_at < now()).
// Protected by CRON_SECRET (Vercel cron sends Authorization: Bearer <CRON_SECRET>).
// Deletes expired demo orgs (is_demo = true AND demo_expires_at < now()) only.
// Set DEMO_CLEANUP_DELETE=false for a dry run (log-only, no deletes).

const REF_COLS: Record<string, string> = {
  org_id: "organizations", company_id: "companies", location_id: "locations", truck_id: "trucks",
  driver_id: "drivers", user_id: "users", battery_id: "batteries", customer_id: "customers", vehicle_id: "vehicles",
};
// demo_leads is the permanent lead log: never cleaned up.
const SKIP_TABLES = new Set(["organizations", "public_rate_limits", "demo_leads"]);

type Cols = Map<string, Set<string>>;

async function loadColumns(): Promise<Cols> {
  const { rows } = await sql`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public'`;
  const m: Cols = new Map();
  for (const r of rows) {
    if (!m.has(r.table_name)) m.set(r.table_name, new Set());
    m.get(r.table_name)!.add(r.column_name);
  }
  return m;
}

async function idsOf(cols: Cols, table: string, scope: Record<string, string[]>): Promise<string[]> {
  const c = cols.get(table);
  if (!c || !c.has("id")) return [];
  const conds: string[] = []; const params: string[][] = [];
  for (const k of ["org_id", "company_id"]) {
    if (c.has(k) && scope[k]?.length) { params.push(scope[k]); conds.push(`"${k}"::text = ANY($${params.length}::text[])`); }
  }
  if (!conds.length) return [];
  const { rows } = await sql.query(`SELECT id::text AS id FROM "${table}" WHERE ${conds.join(" OR ")}`, params);
  return rows.map((r) => r.id);
}

async function cleanOrg(cols: Cols, orgId: string, doDelete: boolean) {
  const scope: Record<string, string[]> = { org_id: [orgId] };
  scope.company_id = await idsOf(cols, "companies", scope);
  for (const [col, table] of Object.entries(REF_COLS)) {
    if (col === "org_id" || col === "company_id") continue;
    scope[col] = await idsOf(cols, table, scope);
  }
  // Every table row referencing any of this org's ids.
  const targets: { table: string; where: string; params: string[][] }[] = [];
  for (const [table, c] of cols) {
    if (SKIP_TABLES.has(table)) continue;
    const conds: string[] = []; const params: string[][] = [];
    for (const col of Object.keys(REF_COLS)) {
      if (c.has(col) && scope[col]?.length) { params.push(scope[col]); conds.push(`"${col}"::text = ANY($${params.length}::text[])`); }
    }
    if (conds.length) targets.push({ table, where: conds.join(" OR "), params });
  }
  const counts: Record<string, number> = {};
  for (const t of targets) {
    const { rows } = await sql.query(`SELECT count(*)::int AS n FROM "${t.table}" WHERE ${t.where}`, t.params);
    if (rows[0].n) counts[t.table] = rows[0].n;
  }
  const errors: string[] = [];
  if (doDelete) {
    let pending = targets.filter((t) => counts[t.table]);
    for (let pass = 0; pass < 8 && pending.length; pass++) {
      const next: typeof pending = [];
      for (const t of pending) {
        try { await sql.query(`DELETE FROM "${t.table}" WHERE ${t.where}`, t.params); }
        catch (e) { next.push(t); if (pass === 7) errors.push(`${t.table}: ${e instanceof Error ? e.message : e}`); }
      }
      pending = next;
    }
    if (!pending.length) {
      // Re-check demo flag in the final statement for safety.
      await sql`DELETE FROM organizations WHERE id::text = ${orgId} AND is_demo = true AND demo_expires_at < now()`;
    }
  }
  return { orgId, counts, errors };
}

export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = (req.headers.get("authorization") || "").trim();
  // Vercel scheduled crons send "Authorization: Bearer <CRON_SECRET>".
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    await ensureDemoTables();
    // Default is to delete expired demo orgs. Dry-run only when explicitly disabled.
    const doDelete = process.env.DEMO_CLEANUP_DELETE !== "false";
    const { rows } = await sql`
      SELECT id::text AS id, name FROM organizations
      WHERE is_demo = true AND demo_expires_at IS NOT NULL AND demo_expires_at < now()
      ORDER BY demo_expires_at LIMIT 25`;
    const cols = rows.length ? await loadColumns() : new Map();
    const results = [];
    for (const r of rows) results.push({ name: r.name, ...(await cleanOrg(cols, r.id, doDelete)) });
    console.log("[demo-cleanup]", JSON.stringify({ mode: doDelete ? "delete" : "log-only", results }));
    return NextResponse.json({ success: true, mode: doDelete ? "delete" : "log-only", expired: rows.length, results });
  } catch (err) {
    console.error("[demo-cleanup] failed", err);
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
