import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { rows: locations } = await sql`
      SELECT locations.id, locations.name, locations.slug AS location_slug,
             companies.name AS company_name, companies.slug AS company_slug
      FROM locations
      JOIN companies ON companies.id = locations.company_id
      JOIN user_companies ON user_companies.company_id = companies.id
      WHERE user_companies.user_id = ${session.user.id}
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
