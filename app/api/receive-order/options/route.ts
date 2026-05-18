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
      SELECT locations.id, locations.name, companies.name AS company_name
      FROM locations
      JOIN companies ON companies.id = locations.company_id
      JOIN user_companies ON user_companies.company_id = companies.id
      WHERE user_companies.user_id = ${session.user.id}
        AND locations.active = TRUE
      ORDER BY companies.name, locations.name;
    `;

    const { rows: batteryTypes } = await sql`
      SELECT code FROM battery_types ORDER BY code;
    `;

    return NextResponse.json({
      locations: locations.map(l => ({
        id: l.id, name: l.name, companyName: l.company_name,
      })),
      batteryTypes,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
