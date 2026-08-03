// app/api/signup/route.ts
// POST: provision a brand-new organization for the signed-in, org-less user.
// GATED: the caller's email must be present (and unused) in signup_invites.
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
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "org";
}

// Reserved because they would collide with real paths, or are confusing as a
// customer identifier in a URL.
const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "d", "driver", "drivers", "login", "logout",
  "manager", "onboarding", "pending", "settings", "signup", "support",
  "team", "www", "new", "null", "undefined",
]);

// Take the clean slug when it is free, and only add -2, -3 ... on an actual
// collision. The old scheme always appended 6 characters of the UUID, which
// produced links like /d/swift-towing-4b2e91/driver - hard to read out over
// the radio and hard to type on a phone.
//
// `table` is a fixed string chosen by the caller below, never user input.
async function uniqueSlug(
  base: string,
  table: "organizations" | "companies" | "locations"
): Promise<string> {
  let candidate = base;
  if (RESERVED_SLUGS.has(candidate)) candidate = `${base}-1`;

  for (let attempt = 0; attempt < 25; attempt++) {
    let taken = false;

    if (table === "organizations") {
      const { rows } = await sql`
        SELECT 1 FROM organizations WHERE lower(slug) = ${candidate} LIMIT 1;
      `;
      taken = rows.length > 0;
    } else if (table === "companies") {
      const { rows } = await sql`
        SELECT 1 FROM companies WHERE lower(slug) = ${candidate} LIMIT 1;
      `;
      taken = rows.length > 0;
    } else {
      const { rows } = await sql`
        SELECT 1 FROM locations WHERE lower(slug) = ${candidate} LIMIT 1;
      `;
      taken = rows.length > 0;
    }

    if (!taken) return candidate;
    candidate = `${base}-${attempt + 2}`;
  }

  // 25 collisions on one name is implausible - fall back to a unique suffix
  // rather than looping forever.
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

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

  // GATE: email must be invited and unused.
  const { rows: inviteRows } = await sql`
    SELECT email, used FROM signup_invites WHERE email = ${email} LIMIT 1;
  `;
  if (inviteRows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Your email is not on the invite list. Contact us to request access." },
      { status: 403 }
    );
  }
  if (inviteRows[0].used === true) {
    return NextResponse.json(
      { success: false, error: "This invite has already been used." },
      { status: 403 }
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
    // 1. Organization. plan/status/created_at/supplier_name all default.
    const orgId = crypto.randomUUID();
    const orgSlug = await uniqueSlug(slugify(orgName), "organizations");
    await sql`
      INSERT INTO organizations (id, name, slug)
      VALUES (${orgId}, ${orgName}, ${orgSlug});
    `;

    // 2. Company under the new org.
    const companyId = crypto.randomUUID();
    const companySlug = await uniqueSlug(slugify(companyName), "companies");
    await sql`
      INSERT INTO companies (id, org_id, slug, name, legal_entity, active)
      VALUES (${companyId}, ${orgId}, ${companySlug}, ${companyName}, ${legalEntity}, true);
    `;

    // 3. First location under the company.
    const locationId = crypto.randomUUID();
    const locationSlug = await uniqueSlug(slugify(locationName), "locations");
    await sql`
      INSERT INTO locations (id, company_id, slug, name, city, state, active)
      VALUES (${locationId}, ${companyId}, ${locationSlug}, ${locationName}, ${city}, ${state}, true);
    `;

    // 4. Promote the caller: set their org + owner role, link to the company.
    await sql`
      UPDATE users SET org_id = ${orgId}, role = 'owner' WHERE id = ${user.userId};
    `;
    await sql`
      INSERT INTO user_companies (user_id, company_id)
      VALUES (${user.userId}, ${companyId})
      ON CONFLICT DO NOTHING;
    `;

    // 5. Seed this org's default battery types (idempotent on code).
    //    NOTE: battery_types.code is globally unique in the current schema, so
    //    these are shared reference rows. ON CONFLICT DO NOTHING means the first
    //    org to sign up creates them and later orgs simply reuse them. If you
    //    later make battery types per-org, add org_id here.
    const defaultTypes: Array<[string, string, string, string, number, number]> = [
      ["Alpha", "Standard flooded lead-acid", "85.00", "159.00", 20, 50],
      ["Bravo", "Mid-range maintenance-free", "105.00", "189.00", 40, 100],
      ["Charlie", "High-performance starting battery", "135.00", "229.00", 30, 60],
      ["AGM", "Absorbent Glass Mat - premium", "175.00", "289.00", 15, 30],
    ];
    for (const [code, desc, cost, price, parMin, parMax] of defaultTypes) {
      await sql`
        INSERT INTO battery_types
          (id, code, name, description, default_cost, default_price, par_level_min, par_level_max)
        VALUES
          (${crypto.randomUUID()}, ${code}, ${code}, ${desc},
           ${cost}, ${price}, ${parMin}, ${parMax})
        ON CONFLICT (code) DO NOTHING;
      `;
    }

    // 6. Burn the invite.
    await sql`
      UPDATE signup_invites SET used = true, used_at = now() WHERE email = ${email};
    `;

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
