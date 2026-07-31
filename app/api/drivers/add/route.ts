import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";

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
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Name is required." },
        { status: 400 }
      );
    }
    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Cell number is required." },
        { status: 400 }
      );
    }
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "Company is required." },
        { status: 400 }
      );
    }

    // Verify the company exists before inserting.
    // TENANT BOUNDARY: the company must belong to the caller's organization,
    // not merely exist. Without the org_id filter a user of one org could
    // attach a driver to another org's company.
    const { rows: companyRows } = await sql`
      SELECT id FROM companies
      WHERE id = ${companyId} AND org_id = ${user.orgId}
      LIMIT 1;
    `;
    if (companyRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Selected company not found." },
        { status: 400 }
      );
    }

    const { rows } = await sql`
      INSERT INTO drivers (id, name, phone, company_id, active, created_at, updated_at)
      VALUES (gen_random_uuid(), ${name}, ${phone}, ${companyId}, true, now(), now())
      RETURNING id;
    `;

    return NextResponse.json({ success: true, id: rows[0].id });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
