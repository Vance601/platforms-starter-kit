import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function GET() {
  // Accept BOTH auth paths: the GitHub/NextAuth session (owner) and the
  // manager_session cookie (staff). Calling auth() directly only saw GitHub
  // sessions, so a signed-in manager got "Unauthorized" on page load and
  // could not receive stock.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { rows: locations } = await sql`
      SELECT locations.id, locations.name, locations.slug AS location_slug,
             companies.name AS company_name, companies.slug AS company_slug
      FROM locations
      JOIN companies ON companies.id = locations.company_id
      WHERE companies.org_id = ${user.orgId}
        AND locations.active = TRUE
      ORDER BY companies.name, locations.name;
    `;

    const { rows: classifications } = await sql`
      SELECT code FROM battery_types ORDER BY code;
    `;

    const { rows: models } = await sql`
      SELECT battery_models.code, battery_models.display_name,
             battery_types.code AS classification_code
      FROM battery_models
      JOIN battery_types ON battery_types.id = battery_models.battery_type_id
      WHERE battery_models.active = TRUE
      ORDER BY battery_types.code, battery_models.code;
    `;

    return NextResponse.json({
      locations: locations.map(l => ({
        id: l.id,
        name: l.name,
        locationSlug: l.location_slug,
        companyName: l.company_name,
        companySlug: l.company_slug,
      })),
      classifications: classifications.map(c => c.code),
      models: models.map(m => ({
        code: m.code,
        displayName: m.display_name,
        classification: m.classification_code,
      })),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
