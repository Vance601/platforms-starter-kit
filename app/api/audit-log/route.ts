import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { requireOrg } from "@/lib/require-org";
import { ensureAuditTable } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Latest audit entries for the caller's organization (owner/manager only).
export async function GET(req: Request) {
  const g = await requireOrg({ roles: ["owner", "manager"] });
  if (!g.ok) return g.response;
  const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit")) || 100, 1), 500);
  await ensureAuditTable();
  const { rows } = await sql`
    SELECT id, occurred_at, actor_type, actor_id, actor_name, action, entity_type, entity_id, details
    FROM audit_log
    WHERE org_id = ${String(g.orgId)}
    ORDER BY occurred_at DESC
    LIMIT ${limit};
  `;
  return NextResponse.json({ success: true, entries: rows });
}
