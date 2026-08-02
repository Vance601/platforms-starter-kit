import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Soft delete: mark the driver inactive instead of deleting the row, so any
// historical records (loads, sales, conversions) stay linked to a real name.
// The roster GET filters WHERE active = true, so inactive drivers drop off it.
//
// Auth: getCurrentUser() resolves BOTH the GitHub/NextAuth session (owner) and
// the manager_session cookie. Calling auth() directly here used to reject
// managers outright. Owner/manager role required, and the driver must belong to
// a company inside the caller's org.
export async function POST(req: Request) {
  try {
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
    const id = typeof body.id === "string" ? body.id.trim() : "";

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Driver id is required." },
        { status: 400 }
      );
    }

    // Scoped update: a driver in another org matches zero rows and 404s,
    // which is also what an unknown id does - no existence leak either way.
    const { rows } = await sql`
      UPDATE drivers
      SET active = false,
          updated_at = now()
      WHERE id = ${id}
        AND company_id IN (
          SELECT id FROM companies WHERE org_id = ${user.orgId}
        )
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
