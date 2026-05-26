import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Real driver roster, read live from Neon. Only active drivers, joined to
// companies for a readable name. Also returns company_id so the edit dialog
// can pre-select the driver's current company.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Not signed in." },
        { status: 401 }
      );
    }

    const { rows } = await sql`
      SELECT
        d.id          AS id,
        d.name        AS name,
        d.phone       AS phone,
        d.active      AS active,
        d.company_id  AS company_id,
        c.name        AS company
      FROM drivers d
      LEFT JOIN companies c ON c.id = d.company_id
      WHERE d.active = true
      ORDER BY d.name ASC;
    `;

    const drivers = rows.map((r) => ({
      id: r.id as string,
      name: (r.name as string) || "Unnamed",
      phone: (r.phone as string) || "",
      active: Boolean(r.active),
      companyId: (r.company_id as string) || "",
      company: (r.company as string) || "Unassigned",
    }));

    return NextResponse.json({ success: true, drivers });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
