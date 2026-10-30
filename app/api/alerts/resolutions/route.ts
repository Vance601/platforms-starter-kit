import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { requireOrg } from "@/lib/require-org";

export const dynamic = "force-dynamic";

// Alert resolutions, stored per organization (previously browser localStorage).
// An alert counts as resolved while its stored signature matches the live one.
async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS alert_resolutions (
    org_id TEXT NOT NULL,
    alert_id TEXT NOT NULL,
    signature TEXT NOT NULL,
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (org_id, alert_id)
  )`;
}

export async function GET() {
  const g = await requireOrg();
  if (!g.ok) return g.response;
  await ensureTable();
  const r = await sql`SELECT alert_id, signature FROM alert_resolutions WHERE org_id = ${g.orgId}`;
  const resolved: Record<string, string> = {};
  for (const row of r.rows) resolved[row.alert_id] = row.signature;
  return NextResponse.json({ success: true, resolved });
}

// Body: { resolutions: [{ alertId, signature }] } (one or many; used for migration too)
export async function POST(req: NextRequest) {
  const g = await requireOrg();
  if (!g.ok) return g.response;
  const body = await req.json().catch(() => ({}));
  const list: { alertId: string; signature: string }[] = Array.isArray(body?.resolutions) ? body.resolutions : [];
  const clean = list
    .filter((x) => x && typeof x.alertId === "string" && typeof x.signature === "string")
    .slice(0, 500);
  if (clean.length === 0) return NextResponse.json({ success: false, error: "Nothing to save." }, { status: 400 });
  await ensureTable();
  const who = String((g.user as { email?: string }).email ?? "");
  for (const x of clean) {
    await sql`
      INSERT INTO alert_resolutions (org_id, alert_id, signature, resolved_by)
      VALUES (${g.orgId}, ${x.alertId.slice(0, 200)}, ${x.signature.slice(0, 500)}, ${who})
      ON CONFLICT (org_id, alert_id) DO UPDATE
        SET signature = EXCLUDED.signature, resolved_by = EXCLUDED.resolved_by, resolved_at = now()`;
  }
  return NextResponse.json({ success: true, saved: clean.length });
}
