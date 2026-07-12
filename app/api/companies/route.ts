import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Live list of THIS ORG's companies for pickers (e.g. Add Driver, Add Location).
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
    }
    if (user.role !== "owner" && user.role !== "manager") {
      return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
    }
    if (!user.orgId) {
      return NextResponse.json({ success: true, companies: [] });
    }

    const { rows } = await sql`
      SELECT id, name
      FROM companies
      WHERE org_id = ${user.orgId}
      ORDER BY name ASC;
    `;

    const companies = rows.map((r) => ({
      id: r.id as string,
      name: (r.name as string) || "Unnamed company",
    }));

    return NextResponse.json({ success: true, companies });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
