import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/locations/delete
// Soft-deletes a location by marking it inactive. Owner/manager only.
// We do NOT physically remove the row, because batteries, core counts, and
// reconciliation reports reference locations. Setting active = false hides it
// from pickers while preserving historical accuracy.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
  }
  if (user.role !== "owner" && user.role !== "manager") {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const id = (body.id || "").trim();
  if (!id) {
    return NextResponse.json({ success: false, error: "Location id is required." }, { status: 400 });
  }

  try {
    // Guard: if the location still has batteries tied to it, warn instead of
    // silently hiding a location that active inventory depends on.
    const { rows: batteryRows } = await sql`
      SELECT COUNT(*)::int AS cnt FROM batteries WHERE location_id = ${id};
    `;
    const batteryCount = batteryRows[0]?.cnt ?? 0;

    const { rows } = await sql`
      UPDATE locations
      SET active = false
      WHERE id = ${id}
      RETURNING id, name;
    `;

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: "Location not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      id: rows[0].id,
      name: rows[0].name,
      batteryCount,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
