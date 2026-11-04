// Demo lead log: who started a demo. Lives in its own table keyed by
// demo_org_id (deliberately NOT org_id) so the demo cleanup cron never deletes it.
import { sql } from "@vercel/postgres";
import type { CurrentUser } from "@/lib/current-user";

let ready: Promise<unknown> | null = null;
export function ensureDemoLeadsTable() {
  if (!ready) {
    ready = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS demo_leads (
          id           BIGSERIAL PRIMARY KEY,
          name         TEXT NOT NULL,
          email        TEXT NOT NULL,
          company      TEXT,
          phone        TEXT,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
          demo_org_id  TEXT,
          ip           TEXT,
          city         TEXT,
          region       TEXT,
          country      TEXT,
          user_agent   TEXT,
          device       TEXT,
          referrer     TEXT,
          utm_source   TEXT,
          utm_medium   TEXT,
          utm_campaign TEXT,
          utm_term     TEXT,
          utm_content  TEXT,
          resumed      BOOLEAN NOT NULL DEFAULT false,
          last_seen    TIMESTAMPTZ,
          logins       INT NOT NULL DEFAULT 1,
          actions      INT NOT NULL DEFAULT 0,
          sales        INT NOT NULL DEFAULT 0
        );`;
      await sql`CREATE INDEX IF NOT EXISTS demo_leads_created_idx ON demo_leads (created_at DESC);`;
      await sql`CREATE INDEX IF NOT EXISTS demo_leads_org_idx ON demo_leads (demo_org_id);`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

// Platform owner = owner/admin of the (non-demo) Duggers org, identified by its
// company slugs. Other tenants' owners/admins never qualify.
export async function isPlatformOwner(u: CurrentUser | null): Promise<boolean> {
  if (!u?.orgId || !["owner", "admin"].includes(u.dbRole ?? "")) return false;
  try {
    const { rows } = await sql`
      SELECT 1 FROM companies c JOIN organizations o ON o.id::text = c.org_id::text
      WHERE c.org_id::text = ${u.orgId} AND lower(c.slug) IN ('abq', 'phx', 'tucson')
        AND coalesce(o.is_demo, false) = false
      LIMIT 1;`;
    return rows.length > 0;
  } catch {
    return false;
  }
}

export function deviceOf(ua: string): string {
  const s = ua.toLowerCase();
  if (!s) return "unknown";
  if (/bot|crawl|spider|headless/.test(s)) return "bot";
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/mobi|iphone|android/.test(s)) return "mobile";
  return "desktop";
}

// Refresh activity stats from live demo data (snapshot is kept after cleanup).
export async function refreshLeadStats(): Promise<void> {
  try {
    await sql`
      UPDATE demo_leads l SET
        actions   = GREATEST(l.actions, s.actions),
        last_seen = GREATEST(l.last_seen, s.last_seen)
      FROM (
        SELECT org_id, COUNT(*)::int AS actions, MAX(occurred_at) AS last_seen
        FROM audit_log WHERE org_id IN (SELECT demo_org_id FROM demo_leads WHERE demo_org_id IS NOT NULL)
        GROUP BY org_id
      ) s
      WHERE s.org_id = l.demo_org_id;`;
  } catch {}
  try {
    // Seeded sample sales exist at creation; count only ones made after the lead started.
    await sql`
      UPDATE demo_leads l SET sales = GREATEST(l.sales, s.n)
      FROM (
        SELECT r.org_id, COUNT(*)::int AS n FROM sale_records r
        JOIN demo_leads d ON d.demo_org_id = r.org_id AND r.created_at > d.created_at + interval '1 minute'
        GROUP BY r.org_id
      ) s
      WHERE s.org_id = l.demo_org_id;`;
  } catch {}
}
