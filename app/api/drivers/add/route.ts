import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // Accepts the GitHub session AND the manager_session cookie.
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not signed in." },
        { status: 401 }
      );
    }
    if (user.role !== "owner" && user.role !== "manager") {
      return NextResponse.json(
        { success: false, error: "Not authorized." },
        { status: 403 }
      );
    }
    if (!user.orgId) {
      return NextResponse.json(
        { success: false, error: "No organization context." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const truckNumber = typeof body.truckNumber === "string" ? body.truckNumber.trim() : "";
    const yearModel   = typeof body.yearModel   === "string" ? body.yearModel.trim()   : "";
    const vinLast5    = typeof body.vinLast5    === "string" ? body.vinLast5.trim()    : "";
    const companySlug = typeof body.companySlug === "string" ? body.companySlug.trim() : "phx";

    if (!truckNumber) {
      return NextResponse.json(
        { success: false, error: "Truck number is required." },
        { status: 400 }
      );
    }

    // TENANT BOUNDARY: resolve the slug only inside the caller's org. Slugs
    // are not globally unique across organizations, so an unscoped lookup
    // could resolve to another tenant's company.
    const { rows: companyRows } = await sql`
      SELECT id FROM companies
      WHERE slug = ${companySlug} AND org_id = ${user.orgId}
      LIMIT 1;
    `;
    if (companyRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Company not found." },
        { status: 400 }
      );
    }
    const companyId = companyRows[0].id;

    // Don't allow a duplicate truck number inside the same company.
    const { rows: existing } = await sql`
      SELECT id FROM trucks
      WHERE truck_number = ${truckNumber} AND company_id = ${companyId}
      LIMIT 1;
    `;
    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: `Truck #${truckNumber} already exists in this company.` },
        { status: 409 }
      );
    }

    const id = crypto.randomUUID();
    await sql`
      INSERT INTO trucks
        (id, truck_number, year_model, vin_last5, company_id, active, created_at, updated_at)
      VALUES
        (${id}, ${truckNumber}, ${yearModel || null}, ${vinLast5 || null}, ${companyId}, true, NOW(), NOW());
    `;

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
