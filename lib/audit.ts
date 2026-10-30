// Append-only audit log of key actions (loads, sales, approvals, logins,
// password resets, driver changes). One additive table created on first use.
// Logging must never break the action it records, so all errors are swallowed.
import { sql } from "@vercel/postgres";

let ready: Promise<unknown> | null = null;
export function ensureAuditTable() {
  if (!ready) {
    ready = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS audit_log (
          id           BIGSERIAL PRIMARY KEY,
          occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          org_id       TEXT,
          company_id   TEXT,
          actor_type   TEXT NOT NULL,
          actor_id     TEXT,
          actor_name   TEXT,
          action       TEXT NOT NULL,
          entity_type  TEXT,
          entity_id    TEXT,
          details      JSONB,
          ip           TEXT
        );
      `;
      await sql`CREATE INDEX IF NOT EXISTS audit_log_org_time_idx ON audit_log (org_id, occurred_at DESC);`;
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

export type AuditEntry = {
  action: string;
  actorType: "user" | "manager" | "driver" | "system" | "anonymous";
  actorId?: string | number | null;
  actorName?: string | null;
  orgId?: string | number | null;
  companyId?: string | number | null;
  entityType?: string | null;
  entityId?: string | number | null;
  details?: Record<string, unknown> | null;
  req?: Request | null;
};

const s = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

export async function logAudit(e: AuditEntry): Promise<void> {
  try {
    await ensureAuditTable();
    const ip = e.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    let orgId = s(e.orgId);
    const companyId = s(e.companyId);
    if (!orgId && companyId) {
      const { rows } = await sql`SELECT org_id FROM companies WHERE id = ${companyId} LIMIT 1;`;
      orgId = s(rows[0]?.org_id);
    }
    if (!orgId && (e.actorType === "manager" || e.actorType === "user" || e.entityType === "user")) {
      const uid = e.entityType === "user" ? s(e.entityId) : s(e.actorId);
      if (uid) {
        try {
          const { rows } = await sql`SELECT org_id FROM users WHERE id = ${uid} LIMIT 1;`;
          orgId = s(rows[0]?.org_id);
        } catch {}
      }
    }
    await sql`
      INSERT INTO audit_log (org_id, company_id, actor_type, actor_id, actor_name, action, entity_type, entity_id, details, ip)
      VALUES (${orgId}, ${companyId}, ${e.actorType}, ${s(e.actorId)}, ${s(e.actorName)}, ${e.action},
              ${s(e.entityType)}, ${s(e.entityId)}, ${e.details ? JSON.stringify(e.details) : null}::jsonb, ${ip});
    `;
  } catch (err) {
    console.error("audit log failed", err);
  }
}
