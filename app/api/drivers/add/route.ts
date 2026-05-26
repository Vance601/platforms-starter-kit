import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Default company for new drivers: Duggers PHX / ERS (slug = 'phx').
// Resolved by slug so it keeps working even if the company id ever changes.
const DEFAULT_COMPANY_SLUG = "phx";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Not signed in." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";

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

    const { rows: companyRows } = await sql`
      SELECT id FROM companies WHERE slug = ${DEFAULT_COMPANY_SLUG} LIMIT 1;
    `;
    if (companyRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Default company not found." },
        { status: 500 }
      );
    }
    const companyId = companyRows[0].id as string;

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
