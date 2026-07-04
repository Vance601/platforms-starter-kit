import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/locations/update
// Updates an existing location's editable fields, only if that location belongs
// to the caller's org. Owner/manager only. Does NOT touch the active flag.
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

  let body: {
    id?: string;
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const id = (body.id || "").trim();
  const name = (body.name || "").trim();
  const address = (body.address || "").trim() || null;
  const city = (body.city || "").trim() || null;
  const state = (body.state || "").trim() || null;
  const zip = (body.zip || "").trim() || null;

  if (!id) {
    return NextResponse.json({ success: false, error: "Location id is required." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ success: false, error: "Location name is required." }, { status: 400 });
  }

  try {
    // Tenant guard: the UPDATE only matches a location whose company is in the
    // caller's org. A location id from another org will match zero rows.
    const { rows } = await sql`
      UPDATE locations AS l
      SET name = ${name},
          address = ${address},
          city = ${city},
          state = ${state},
          zip = ${zip}
      FROM companies AS c
      WHERE l.id = ${id}
        AND c.id = l.company_id
        AND c.org_id = ${user.orgId}
      RETURNING l.id, l.name;
    `;

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: "Location not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, id: rows[0].id, name: rows[0].name });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
