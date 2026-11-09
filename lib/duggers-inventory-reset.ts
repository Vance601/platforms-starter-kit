// Duggers-only inventory wipe: backup then delete batteries, sales, warranties,
// deliveries, cores, alerts — never users/drivers/companies/settings/catalog/audit/demo_leads.
import { sql } from "@vercel/postgres";
import { logAudit } from "@/lib/audit";

export type TableDump = { table: string; count: number; rows: Record<string, unknown>[] };
export type ResetPlan = {
  orgId: string;
  orgName: string;
  companyIds: string[];
  companySlugs: string[];
  before: Record<string, number>;
  otherOrgsBefore: Record<string, number>;
};

const INVENTORY_TABLES = [
  // Child → parent-ish order for deletes; backup uses the same set.
  "sale_records",
  "core_returns",
  "sales",
  "battery_movements",
  "delivery_receipt_lines",
  "warranty_pickup_lines",
  "warranty_credit_memo_lines",
  "batteries",
  "delivery_receipts",
  "mbs_invoices",
  "warranty_pickups",
  "warranty_credit_memos",
  "alert_resolutions",
  "customers",
  "vehicles",
] as const;

async function tableExists(name: string): Promise<boolean> {
  const { rows } = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${name} LIMIT 1;`;
  return rows.length > 0;
}

async function columnsOf(name: string): Promise<Set<string>> {
  const { rows } = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${name};`;
  return new Set(rows.map((r) => String(r.column_name)));
}

/** Resolve the real Duggers org (abq/phx/tucson, not a demo). */
export async function resolveDuggersOrg(): Promise<{
  orgId: string;
  orgName: string;
  companyIds: string[];
  companySlugs: string[];
} | null> {
  const { rows } = await sql`
    SELECT o.id AS org_id, o.name AS org_name,
           array_agg(c.id::text ORDER BY c.slug) AS company_ids,
           array_agg(c.slug ORDER BY c.slug) AS company_slugs
    FROM organizations o
    JOIN companies c ON c.org_id = o.id
    WHERE lower(c.slug) IN ('abq', 'phx', 'tucson')
      AND COALESCE(o.is_demo, false) = false
    GROUP BY o.id, o.name
    HAVING COUNT(*) >= 1
    LIMIT 1;`;
  if (!rows[0]) return null;
  return {
    orgId: String(rows[0].org_id),
    orgName: String(rows[0].org_name),
    companyIds: (rows[0].company_ids as string[]) || [],
    companySlugs: (rows[0].company_slugs as string[]) || [],
  };
}

async function countForOrg(
  table: string,
  orgId: string,
  companyIds: string[],
): Promise<number> {
  if (!(await tableExists(table))) return 0;
  const cols = await columnsOf(table);
  if (cols.has("org_id")) {
    const { rows } = await sql.query(
      `SELECT COUNT(*)::int AS n FROM "${table}" WHERE org_id::text = $1`,
      [orgId],
    );
    return Number(rows[0]?.n || 0);
  }
  if (cols.has("company_id") && companyIds.length) {
    const { rows } = await sql.query(
      `SELECT COUNT(*)::int AS n FROM "${table}" WHERE company_id::text = ANY($1::text[])`,
      [companyIds],
    );
    return Number(rows[0]?.n || 0);
  }
  if (table === "battery_movements") {
    const { rows } = await sql.query(
      `SELECT COUNT(*)::int AS n FROM battery_movements bm
       JOIN batteries b ON b.id = bm.battery_id
       WHERE b.company_id::text = ANY($1::text[])`,
      [companyIds],
    );
    return Number(rows[0]?.n || 0);
  }
  if (table === "delivery_receipt_lines") {
    const { rows } = await sql.query(
      `SELECT COUNT(*)::int AS n FROM delivery_receipt_lines l
       JOIN delivery_receipts r ON r.id = l.delivery_receipt_id
       WHERE r.company_id::text = ANY($1::text[])`,
      [companyIds],
    );
    return Number(rows[0]?.n || 0);
  }
  if (table === "warranty_pickup_lines") {
    const { rows } = await sql.query(
      `SELECT COUNT(*)::int AS n FROM warranty_pickup_lines l
       JOIN warranty_pickups p ON p.id = l.warranty_pickup_id
       WHERE p.company_id::text = ANY($1::text[])`,
      [companyIds],
    );
    return Number(rows[0]?.n || 0);
  }
  if (table === "warranty_credit_memo_lines") {
    const { rows } = await sql.query(
      `SELECT COUNT(*)::int AS n FROM warranty_credit_memo_lines l
       JOIN warranty_credit_memos m ON m.id = l.credit_memo_id
       WHERE m.company_id::text = ANY($1::text[])`,
      [companyIds],
    );
    return Number(rows[0]?.n || 0);
  }
  return 0;
}

async function dumpTable(
  table: string,
  orgId: string,
  companyIds: string[],
): Promise<TableDump> {
  if (!(await tableExists(table))) return { table, count: 0, rows: [] };
  const cols = await columnsOf(table);
  let rows: Record<string, unknown>[] = [];
  if (cols.has("org_id")) {
    ({ rows } = await sql.query(`SELECT * FROM "${table}" WHERE org_id::text = $1`, [orgId]));
  } else if (cols.has("company_id") && companyIds.length) {
    ({ rows } = await sql.query(
      `SELECT * FROM "${table}" WHERE company_id::text = ANY($1::text[])`,
      [companyIds],
    ));
  } else if (table === "battery_movements") {
    ({ rows } = await sql.query(
      `SELECT bm.* FROM battery_movements bm
       JOIN batteries b ON b.id = bm.battery_id
       WHERE b.company_id::text = ANY($1::text[])`,
      [companyIds],
    ));
  } else if (table === "delivery_receipt_lines") {
    ({ rows } = await sql.query(
      `SELECT l.* FROM delivery_receipt_lines l
       JOIN delivery_receipts r ON r.id = l.delivery_receipt_id
       WHERE r.company_id::text = ANY($1::text[])`,
      [companyIds],
    ));
  } else if (table === "warranty_pickup_lines") {
    ({ rows } = await sql.query(
      `SELECT l.* FROM warranty_pickup_lines l
       JOIN warranty_pickups p ON p.id = l.warranty_pickup_id
       WHERE p.company_id::text = ANY($1::text[])`,
      [companyIds],
    ));
  } else if (table === "warranty_credit_memo_lines") {
    ({ rows } = await sql.query(
      `SELECT l.* FROM warranty_credit_memo_lines l
       JOIN warranty_credit_memos m ON m.id = l.credit_memo_id
       WHERE m.company_id::text = ANY($1::text[])`,
      [companyIds],
    ));
  }
  return { table, count: rows.length, rows };
}

export async function buildResetPlan(): Promise<ResetPlan> {
  const org = await resolveDuggersOrg();
  if (!org) throw new Error("Duggers org (abq/phx/tucson, non-demo) not found.");
  const before: Record<string, number> = {};
  for (const t of INVENTORY_TABLES) {
    before[t] = await countForOrg(t, org.orgId, org.companyIds);
  }
  // Snapshot other orgs' battery counts so we can prove we didn't touch them.
  const { rows: other } = await sql`
    SELECT o.id::text AS org_id, o.name, COUNT(b.id)::int AS batteries
    FROM organizations o
    JOIN companies c ON c.org_id = o.id
    LEFT JOIN batteries b ON b.company_id = c.id
    WHERE o.id::text <> ${org.orgId}
    GROUP BY o.id, o.name
    ORDER BY batteries DESC;`;
  const otherOrgsBefore: Record<string, number> = {};
  for (const r of other) otherOrgsBefore[`${r.name} (${r.org_id.slice(0, 8)})`] = Number(r.batteries);
  return { ...org, before, otherOrgsBefore };
}

export async function backupDuggersInventory(): Promise<{
  plan: ResetPlan;
  dumps: TableDump[];
  exportedAt: string;
}> {
  const plan = await buildResetPlan();
  const dumps: TableDump[] = [];
  for (const t of INVENTORY_TABLES) {
    dumps.push(await dumpTable(t, plan.orgId, plan.companyIds));
  }
  return { plan, dumps, exportedAt: new Date().toISOString() };
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}

export function dumpsToFiles(dumps: TableDump[], plan: ResetPlan, exportedAt: string): {
  json: Record<string, string>;
  csv: Record<string, string>;
  manifest: string;
} {
  const json: Record<string, string> = {};
  const csv: Record<string, string> = {};
  const lines = [
    `Duggers inventory backup`,
    `exportedAt=${exportedAt}`,
    `orgId=${plan.orgId}`,
    `orgName=${plan.orgName}`,
    `companies=${plan.companySlugs.join(",")}`,
    ``,
    `table,backup_rows,plan_count,match`,
  ];
  for (const d of dumps) {
    json[`${d.table}.json`] = JSON.stringify(d.rows, null, 2);
    csv[`${d.table}.csv`] = toCsv(d.rows);
    const expected = plan.before[d.table] ?? 0;
    lines.push(`${d.table},${d.count},${expected},${d.count === expected ? "OK" : "MISMATCH"}`);
  }
  lines.push(``, `otherOrgsBatteryCounts=` + JSON.stringify(plan.otherOrgsBefore));
  return { json, csv, manifest: lines.join("\n") };
}

export async function deleteDuggersInventory(plan: ResetPlan): Promise<{
  deleted: Record<string, number>;
  after: Record<string, number>;
  otherOrgsAfter: Record<string, number>;
}> {
  const { orgId, companyIds } = plan;
  const deleted: Record<string, number> = {};

  await sql.query("BEGIN");
  try {
    // Explicit FK-safe order.
    const steps: Array<[string, string, unknown[]]> = [
      ["sale_records", `DELETE FROM sale_records WHERE org_id::text = $1`, [orgId]],
      [
        "core_returns",
        `DELETE FROM core_returns WHERE company_id::text = ANY($1::text[])`,
        [companyIds],
      ],
      ["sales", `DELETE FROM sales WHERE company_id::text = ANY($1::text[])`, [companyIds]],
      [
        "battery_movements",
        `DELETE FROM battery_movements WHERE battery_id IN (
           SELECT id FROM batteries WHERE company_id::text = ANY($1::text[]))`,
        [companyIds],
      ],
      [
        "delivery_receipt_lines",
        `DELETE FROM delivery_receipt_lines WHERE delivery_receipt_id IN (
           SELECT id FROM delivery_receipts WHERE company_id::text = ANY($1::text[]))`,
        [companyIds],
      ],
      [
        "warranty_pickup_lines",
        `DELETE FROM warranty_pickup_lines WHERE warranty_pickup_id IN (
           SELECT id FROM warranty_pickups WHERE company_id::text = ANY($1::text[]))`,
        [companyIds],
      ],
      [
        "warranty_credit_memo_lines",
        `DELETE FROM warranty_credit_memo_lines WHERE credit_memo_id IN (
           SELECT id FROM warranty_credit_memos WHERE company_id::text = ANY($1::text[]))`,
        [companyIds],
      ],
      ["batteries", `DELETE FROM batteries WHERE company_id::text = ANY($1::text[])`, [companyIds]],
      [
        "delivery_receipts",
        `DELETE FROM delivery_receipts WHERE company_id::text = ANY($1::text[])`,
        [companyIds],
      ],
      ["mbs_invoices", `DELETE FROM mbs_invoices WHERE company_id::text = ANY($1::text[])`, [companyIds]],
      [
        "warranty_pickups",
        `DELETE FROM warranty_pickups WHERE company_id::text = ANY($1::text[])`,
        [companyIds],
      ],
      [
        "warranty_credit_memos",
        `DELETE FROM warranty_credit_memos WHERE company_id::text = ANY($1::text[])`,
        [companyIds],
      ],
      ["alert_resolutions", `DELETE FROM alert_resolutions WHERE org_id::text = $1`, [orgId]],
      ["customers", `DELETE FROM customers WHERE org_id::text = $1`, [orgId]],
      ["vehicles", `DELETE FROM vehicles WHERE org_id::text = $1`, [orgId]],
    ];

    for (const [table, q, params] of steps) {
      if (!(await tableExists(table))) {
        deleted[table] = 0;
        continue;
      }
      try {
        const { rowCount } = await sql.query(q, params);
        deleted[table] = rowCount ?? 0;
      } catch (e) {
        // Table or column may not exist in this deploy's schema variant.
        deleted[table] = -1;
        throw e;
      }
    }

    await sql.query("COMMIT");
  } catch (e) {
    await sql.query("ROLLBACK").catch(() => {});
    throw e;
  }

  const after: Record<string, number> = {};
  for (const t of INVENTORY_TABLES) {
    after[t] = await countForOrg(t, orgId, companyIds);
  }
  const { rows: other } = await sql`
    SELECT o.id::text AS org_id, o.name, COUNT(b.id)::int AS batteries
    FROM organizations o
    JOIN companies c ON c.org_id = o.id
    LEFT JOIN batteries b ON b.company_id = c.id
    WHERE o.id::text <> ${orgId}
    GROUP BY o.id, o.name`;
  const otherOrgsAfter: Record<string, number> = {};
  for (const r of other) otherOrgsAfter[`${r.name} (${r.org_id.slice(0, 8)})`] = Number(r.batteries);

  await logAudit({
    action: "inventory.reset",
    actorType: "system",
    actorId: "duggers-inventory-reset",
    orgId,
    entityType: "organization",
    entityId: orgId,
    details: {
      companySlugs: plan.companySlugs,
      deleted,
      before: plan.before,
      after,
      otherOrgsBefore: plan.otherOrgsBefore,
      otherOrgsAfter,
    },
  });

  return { deleted, after, otherOrgsAfter };
}

export { INVENTORY_TABLES, toCsv };
