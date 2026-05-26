import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Driver id is required." },
        { status: 400 }
      );
    }
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

    // Verify the company exists before updating.
    const { rows: companyRows } = await sql`
      SELECT id FROM companies WHERE id = ${companyId} LIMIT 1;
    `;
    if (companyRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Selected company not found." },
        { status: 400 }
      );
    }

    const { rows } = await sql`
      UPDATE drivers
      SET name = ${name},
          phone = ${phone},
          company_id = ${companyId},
          updated_at = now()
      WHERE id = ${id}
      RETURNING id;
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Driver not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id: rows[0].id });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
