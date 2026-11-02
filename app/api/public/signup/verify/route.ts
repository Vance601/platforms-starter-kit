// GET ?token= : consume a verified sign-up, create the org + owner account,
// sign them in (manager_session) and send them to the dashboard.
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto from "crypto";
import { hashToken } from "@/lib/password-reset";
import { ensurePendingSignups, appBaseUrl } from "@/lib/public-signup";
import { provisionOrg, makeOwner } from "@/lib/provision-org";
import { setManagerSession } from "@/lib/manager-session";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const base = appBaseUrl(req);
  const token = req.nextUrl.searchParams.get("token") || "";
  const fail = (why: string) => NextResponse.redirect(`${base}/signup?error=${encodeURIComponent(why)}`);
  if (!/^[a-f0-9]{64}$/.test(token)) return fail("That link is not valid.");

  try {
    await ensurePendingSignups();
    // Atomically consume: a link works once.
    const { rows } = await sql`
      UPDATE pending_signups SET used_at = now()
      WHERE token_hash = ${hashToken(token)} AND used_at IS NULL AND expires_at > now()
      RETURNING payload;
    `;
    if (rows.length === 0) return fail("That link has expired or was already used. Please sign up again.");
    const p = rows[0].payload as {
      name: string; email: string; orgName: string; locationName: string; city: string; state: string;
      passwordHash: string; settings: { barcodePrefix: string; timezone: string; coreCharge: number };
    };

    const { rows: existing } = await sql`SELECT 1 FROM users WHERE lower(email) = ${p.email} LIMIT 1;`;
    if (existing.length > 0) {
      return NextResponse.redirect(`${base}/login?callbackUrl=%2F`);
    }

    const org = await provisionOrg({
      orgName: p.orgName,
      companyName: p.orgName,
      locationName: p.locationName,
      city: p.city,
      state: p.state,
      settings: p.settings,
    });
    const userId = crypto.randomUUID();
    await sql`
      INSERT INTO users (id, name, email, email_verified, role, status, password_hash)
      VALUES (${userId}, ${p.name}, ${p.email}, now(), 'owner', 'active', ${p.passwordHash});
    `;
    await makeOwner(userId, org.orgId, org.companyId);
    await logAudit({ action: "signup.completed", actorType: "manager", actorId: userId, actorName: p.name, orgId: org.orgId, entityType: "organization", entityId: org.orgId, details: { email: p.email }, req });

    const res = NextResponse.redirect(`${base}/`);
    setManagerSession(res, userId);
    return res;
  } catch (err) {
    console.error("[signup/verify] failed", err);
    return fail("Something went wrong creating your account. Please try again.");
  }
}
