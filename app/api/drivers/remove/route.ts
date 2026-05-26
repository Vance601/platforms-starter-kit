import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Soft delete: mark the driver inactive instead of deleting the row, so any
// historical records (loads, sales, conversions) stay linked to a real name.
// The roster GET filters WHERE active = true, so inactive drivers drop off it.
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

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Driver id is required." },
        { status: 400 }
      );
    }

    const { rows } = await sql`
      UPDATE drivers
      SET active = false,
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
