import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET - list this org's suppliers.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
  }
  if (!user.orgId) {
    return NextResponse.json({ success: false, error: "No organization on this account." }, { status: 400 });
  }

  try {
    const { rows } = await sql`
      SELECT id, name
      FROM suppliers
      WHERE org_id = ${user.orgId}
      ORDER BY name ASC;
    `;
    return NextResponse.json({ success: true, suppliers: rows });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST - add a supplier to this org. Owner/manager only.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
  }
  if (user.role !== "owner" && user.role !== "manager") {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }
  if (!user.orgId) {
    return NextResponse.json({ success: false, error: "No organization on this account." }, { status: 400 });
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ success: false, error: "Supplier name is required." }, { status: 400 });
  }

  try {
    // Avoid duplicates within the same org (case-insensitive).
    const { rows: existing } = await sql`
      SELECT id FROM suppliers
      WHERE org_id = ${user.orgId} AND lower(name) = ${name.toLowerCase()}
      LIMIT 1;
    `;
    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: "That supplier already exists." },
        { status: 409 }
      );
    }

    const id = crypto.randomUUID();
    await sql`
      INSERT INTO suppliers (id, org_id, name)
      VALUES (${id}, ${user.orgId}, ${name});
    `;

    return NextResponse.json({ success: true, supplier: { id, name } });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
