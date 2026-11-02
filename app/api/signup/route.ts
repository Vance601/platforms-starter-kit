// app/api/signup/route.ts
// POST: provision a brand-new organization for the signed-in, org-less user.
// An unused signup_invites row is honoured and burned as before; signed-in
// users without an invite may also create their own org (self onboarding),
// rate limited per user.
// All writes use raw sql (the organizations table and users.org_id are not in
// the Drizzle schema, so the typed builder cannot see them).
//
// Steps, in order, for the caller (who is authenticated but has no org yet):
//   1. Confirm caller is signed in and currently has NO org (idempotent guard).
//   2. Confirm caller's email is invited and unused.
//   3. Create organization, company, first location.
//   4. Set caller's users.org_id + role = 'owner'; link user_companies.
//   5. Seed the org's default battery types.
//   6. Mark the invite used.

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";
import { provisionOrg, makeOwner } from "@/lib/provision-org";
import { validateSettingsInput, DEFAULT_ORG_SETTINGS } from "@/lib/org-settings";
import { overLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
  }

  // Idempotent guard: if the caller already has an org, do not create another.
  if (user.orgId) {
    return NextResponse.json(
      { success: false, error: "You already belong to an organization." },
      { status: 409 }
    );
  }

  // Look up the caller's email (needed for the invite gate).
  const { rows: userRows } = await sql`
    SELECT email FROM users WHERE id = ${user.userId} LIMIT 1;
  `;
  const email = (userRows[0]?.email as string | undefined)?.toLowerCase().trim();
  if (!email) {
    return NextResponse.json(
      { success: false, error: "No email on your account." },
      { status: 400 }
    );
  }

  // Invites are optional now; a used invite is still refused so it can't be replayed.
  const { rows: inviteRows } = await sql`
    SELECT email, used FROM signup_invites WHERE email = ${email} LIMIT 1;
  `.catch(() => ({ rows: [] as Record<string, unknown>[] }));
  const invited = inviteRows.length > 0 && inviteRows[0].used !== true;
  if (!invited && (await overLimit(`onboard:user:${user.userId}`, 60 * 24, 3))) {
    return NextResponse.json(
      { success: false, error: "Too many attempts. Please try again tomorrow." },
      { status: 429 }
    );
  }

  // Parse + validate the form body.
  let body: {
    orgName?: string;
    companyName?: string;
    legalEntity?: string;
    locationName?: string;
    city?: string;
    state?: string;
    timezone?: string;
    barcodePrefix?: string;
    coreCharge?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const orgName = (body.orgName || "").trim();
  const companyName = (body.companyName || "").trim();
  const legalEntity = (body.legalEntity || "").trim() || companyName;
  const locationName = (body.locationName || "").trim();
  const city = (body.city || "").trim() || null;
  const state = (body.state || "").trim() || null;

  // Optional business settings; when omitted the org gets the defaults.
  const hasSettings = body.timezone !== undefined || body.barcodePrefix !== undefined || body.coreCharge !== undefined;
  const settings = validateSettingsInput({ ...DEFAULT_ORG_SETTINGS, ...body });
  if (hasSettings && !settings.ok) {
    return NextResponse.json({ success: false, error: settings.error }, { status: 400 });
  }

  if (!orgName) {
    return NextResponse.json({ success: false, error: "Organization name is required." }, { status: 400 });
  }
  if (!companyName) {
    return NextResponse.json({ success: false, error: "Company name is required." }, { status: 400 });
  }
  if (!locationName) {
    return NextResponse.json({ success: false, error: "First location name is required." }, { status: 400 });
  }

  try {
    const { orgId, companyId, locationId } = await provisionOrg({
      orgName, companyName, legalEntity, locationName, city, state,
      settings: hasSettings && settings.ok ? settings.value : null,
    });
    await makeOwner(user.userId, orgId, companyId);

    // 6. Burn the invite.
    if (invited) {
      await sql`
        UPDATE signup_invites SET used = true, used_at = now() WHERE email = ${email};
      `;
    }

    return NextResponse.json({
      success: true,
      orgId,
      companyId,
      locationId,
      message: "Your organization is ready.",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
