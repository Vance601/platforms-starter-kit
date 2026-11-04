// GET: demo details for the signed-in user's org (banner). Non-demo orgs get { isDemo: false }.
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";
import { isDemoOrg, ensureDemoDeliveries } from "@/lib/demo";
import { ensureDemoLeadsTable } from "@/lib/demo-leads";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
  if (!(await isDemoOrg(user.orgId))) return NextResponse.json({ success: true, isDemo: false });
  await ensureDemoDeliveries(String(user.orgId)).catch((e) => console.error("[demo] delivery backfill", e));
  // Lead activity: every demo page load marks the lead as seen.
  await ensureDemoLeadsTable()
    .then(() => sql`UPDATE demo_leads SET last_seen = now() WHERE demo_org_id = ${String(user.orgId)};`)
    .catch(() => {});
  try {
    const { rows } = await sql`
      SELECT o.demo_expires_at, o.slug AS org_slug, d.company_slug, d.driver_name, d.driver_pin
      FROM organizations o LEFT JOIN demo_orgs d ON d.org_id = o.id
      WHERE o.id = ${String(user.orgId)} LIMIT 1;`;
    const r = rows[0] || {};
    return NextResponse.json({
      success: true,
      isDemo: true,
      expiresAt: r.demo_expires_at ? new Date(r.demo_expires_at).toISOString() : null,
      driverName: r.driver_name ?? null,
      driverPin: r.driver_pin ?? null,
      driverUrl: r.org_slug || r.company_slug ? `/d/${r.org_slug || r.company_slug}/driver` : null,
    });
  } catch {
    return NextResponse.json({ success: true, isDemo: true });
  }
}
