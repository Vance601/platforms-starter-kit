// Demo session only: the lead row(s) for YOUR demo org.
// GET    -> what was recorded about you (your own submitted data + stats)
// DELETE -> removes your row, only for reserved test addresses (@example.com),
//           so automated tests can clean up without platform-owner access.
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";
import { isDemoOrg } from "@/lib/demo";
import { ensureDemoLeadsTable } from "@/lib/demo-leads";

export const dynamic = "force-dynamic";

async function gate() {
  const u = await getCurrentUser();
  if (!u?.orgId || !(await isDemoOrg(u.orgId))) return null;
  await ensureDemoLeadsTable();
  return u.orgId;
}

export async function GET() {
  const org = await gate();
  if (!org) return NextResponse.json({ success: false, error: "Not a demo session." }, { status: 403 });
  const { rows } = await sql`
    SELECT id, name, email, company, phone, created_at, demo_org_id, city, region, country, device,
           referrer, utm_source, utm_medium, utm_campaign, last_seen, logins, actions, sales, resumed
    FROM demo_leads WHERE demo_org_id = ${org} ORDER BY id;`;
  return NextResponse.json({ success: true, leads: rows });
}

export async function DELETE() {
  const org = await gate();
  if (!org) return NextResponse.json({ success: false, error: "Not a demo session." }, { status: 403 });
  const { rowCount } = await sql`DELETE FROM demo_leads WHERE demo_org_id = ${org} AND lower(email) LIKE '%@example.com';`;
  return NextResponse.json({ success: true, deleted: rowCount });
}
