import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/locations/delete
// Soft-deletes a location (active = false), only if it belongs to the caller's
// org. History is preserved because batteries, cores, and reports reference it.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
  }
  if (user.role !== "owner" && user.role !== "manager") {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }
  if (!user.orgId) {
    return NextResponse.json({ success: false, error: "No organization context." }, { status: 403 });
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
    // Count batteries still tied to this location (informational, for the UI warning).
    const { rows: batteryRows } = await sql`
      SELECT COUNT(*)::int AS cnt FROM batteries WHERE location_id = ${id};
    `;
    const batteryCount = batteryRows[0]?.cnt ?? 0;

    // Tenant guard: only soft-delete a location whose company is in the caller's org.
    const { rows } = await sql`
      UPDATE locations AS l
      SET active = false
      FROM companies AS c
      WHERE l.id = ${id}
        AND c.id = l.company_id
        AND c.org_id = ${user.orgId}
      RETURNING l.id, l.name;
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
