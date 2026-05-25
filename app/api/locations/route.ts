import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/locations
// Returns all companies (for the add-location dropdown) and all locations
// with their company name and live battery count. Owner/manager only.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
    }
    const role = (session.user as { role?: string }).role;
    if (role !== "owner" && role !== "manager") {
      return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
    }

    const companies = await sql`
      SELECT id, name, slug, active
      FROM companies
      WHERE active = true
      ORDER BY name;
    `;

    const locations = await sql`
      SELECT
        l.id,
        l.name,
        l.slug,
        l.company_id,
        c.name AS company_name,
        l.address,
        l.city,
        l.state,
        l.zip,
        l.active,
        COALESCE(b.cnt, 0)::int AS battery_count
      FROM locations l
      LEFT JOIN companies c ON c.id = l.company_id
      LEFT JOIN (
        SELECT location_id, count(*) AS cnt
        FROM batteries
        GROUP BY location_id
      ) b ON b.location_id = l.id
      ORDER BY c.name, l.name;
    `;

    return NextResponse.json({
      success: true,
      companies: companies.rows,
      locations: locations.rows,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
