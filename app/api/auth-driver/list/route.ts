import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

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
// Usage: /api/auth-driver/list?org=<org slug>
// Legacy: ?company=<company slug> still works and resolves to that company's org.
// Neither -> no drivers. Fail closed.
export async function GET(req: NextRequest) {
  try {
    const orgSlug = (req.nextUrl.searchParams.get("org") || "").trim().toLowerCase();
    const companySlug = (req.nextUrl.searchParams.get("company") || "").trim().toLowerCase();

    if (!orgSlug && !companySlug) {
      return NextResponse.json({
        success: false,
        error: "No company specified.",
        drivers: [],
        org: null,
      });
    }

    let orgRow: { id: string; name: string; slug: string } | undefined;

    if (orgSlug) {
      const { rows } = await sql`
        SELECT id, name, slug FROM organizations
        WHERE lower(slug) = ${orgSlug}
        LIMIT 1;
      `;
      orgRow = rows[0] as typeof orgRow;
    } else {
      // Legacy company link - resolve up to its organization.
      const { rows } = await sql`
        SELECT o.id, o.name, o.slug
        FROM companies c
        JOIN organizations o ON o.id = c.org_id
        WHERE lower(c.slug) = ${companySlug}
        LIMIT 1;
      `;
      orgRow = rows[0] as typeof orgRow;
    }

    if (!orgRow) {
      // Same shape as "no drivers" - never confirm which slugs exist.
      return NextResponse.json({
        success: false,
        error: "Unknown company.",
        drivers: [],
        org: null,
      });
    }

    // Every active driver in every company under this organization.
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
