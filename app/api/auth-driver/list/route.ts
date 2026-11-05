import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { nameKey, normalizeOrgSlug } from "@/lib/org-slug";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Driver name-picker for the login screen. Returns id + name + which company
// the driver belongs to - never pin_hash - so it is safe for a not-yet-logged-in
// driver to call.
//
// UNAUTHENTICATED by necessity (no session exists yet), so it MUST be scoped.
// The scope is the ORGANIZATION, not the company: Dugger's drivers are Dugger's
// drivers whether they work out of Phoenix, Albuquerque or Tucson, and they all
// use one login link. A different customer is a different org and shares nothing.
//
// Accepts ?org= / ?o= / ?company= / ?c= as a slug, a UUID id, or a company/org
// display name. Fail closed when nothing matches.
export async function GET(req: NextRequest) {
  try {
    const rawOrg =
      req.nextUrl.searchParams.get("org") ||
      req.nextUrl.searchParams.get("o") ||
      "";
    const rawCompany =
      req.nextUrl.searchParams.get("company") ||
      req.nextUrl.searchParams.get("c") ||
      "";
    const raw = String(rawOrg || rawCompany || "").trim();
    const orgSlug = normalizeOrgSlug(rawOrg);
    const companySlug = normalizeOrgSlug(rawCompany);
    const key = normalizeOrgSlug(raw);
    const nkey = nameKey(raw);

    if (!orgSlug && !companySlug && !key && !nkey) {
      return NextResponse.json({
        success: false,
        error: "No company specified.",
        drivers: [],
        org: null,
      });
    }

    type OrgRow = { id: string; name: string; slug: string };
    let orgRow: OrgRow | undefined;

    const trySlug = async (slug: string) => {
      if (!slug || orgRow) return;
      const { rows } = await sql`
        SELECT id, name, slug FROM organizations
        WHERE lower(slug) = ${slug}
        LIMIT 1;`;
      orgRow = rows[0] as OrgRow | undefined;
      if (orgRow) return;
      const { rows: cRows } = await sql`
        SELECT o.id, o.name, o.slug
        FROM companies c
        JOIN organizations o ON o.id = c.org_id
        WHERE lower(c.slug) = ${slug}
        LIMIT 1;`;
      orgRow = cRows[0] as OrgRow | undefined;
    };

    await trySlug(orgSlug);
    await trySlug(companySlug);
    await trySlug(key);

    // UUID: org id or company id (legacy / copied links).
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!orgRow && uuidRe.test(raw)) {
      const { rows } = await sql`
        SELECT id, name, slug FROM organizations WHERE id = ${raw} LIMIT 1;`;
      orgRow = rows[0] as OrgRow | undefined;
      if (!orgRow) {
        const { rows: cRows } = await sql`
          SELECT o.id, o.name, o.slug
          FROM companies c JOIN organizations o ON o.id = c.org_id
          WHERE c.id = ${raw} LIMIT 1;`;
        orgRow = cRows[0] as OrgRow | undefined;
      }
    }

    // Display-name match: "Dugger's", "Duggers PHX / ERS", etc.
    if (!orgRow && nkey.length >= 3) {
      const { rows } = await sql`
        SELECT id, name, slug FROM organizations
        WHERE regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = ${nkey}
        LIMIT 1;`;
      orgRow = rows[0] as OrgRow | undefined;
      if (!orgRow) {
        const { rows: cRows } = await sql`
          SELECT o.id, o.name, o.slug
          FROM companies c JOIN organizations o ON o.id = c.org_id
          WHERE regexp_replace(lower(c.name), '[^a-z0-9]', '', 'g') = ${nkey}
          LIMIT 1;`;
        orgRow = cRows[0] as OrgRow | undefined;
      }
      // Prefix: typing "duggers" should match org name "Dugger's".
      if (!orgRow) {
        const { rows: pRows } = await sql`
          SELECT id, name, slug FROM organizations
          WHERE regexp_replace(lower(name), '[^a-z0-9]', '', 'g') LIKE ${nkey + "%"}
          LIMIT 2;`;
        if (pRows.length === 1) orgRow = pRows[0] as OrgRow;
      }
    }

    if (!orgRow) {
      // Temporary diagnostic (no PII): raw + normalized forms only.
      console.info("[auth-driver/list] unknown company", {
        raw: raw.slice(0, 80),
        orgSlug,
        companySlug,
        key,
        nkey: nkey.slice(0, 80),
      });
      return NextResponse.json({
        success: false,
        error: "Unknown company.",
        drivers: [],
        org: null,
      });
    }

    const { rows: drivers } = await sql`
      SELECT d.id,
             d.name,
             c.name AS company_name,
             c.slug AS company_slug
      FROM drivers d
      JOIN companies c ON c.id = d.company_id
      WHERE d.active = TRUE
        AND c.org_id = ${orgRow.id}
      ORDER BY d.name;
    `;

    return NextResponse.json({
      success: true,
      drivers,
      org: { name: orgRow.name, slug: orgRow.slug },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        drivers: [],
        org: null,
      },
      { status: 500 }
    );
  }
}
