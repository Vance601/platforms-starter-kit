import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Turn a location name into a URL-safe slug (lowercase, hyphens, no symbols).
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// POST /api/locations/add
// Creates a new location under a company. Owner/manager only.
// Required: name, companyId. Optional: address, city, state, zip.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
  }
  if (user.role !== "owner" && user.role !== "manager") {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }

  let body: {
    name?: string;
    companyId?: string;
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

  const name = (body.name || "").trim();
  const companyId = (body.companyId || "").trim();
  const address = (body.address || "").trim() || null;
  const city = (body.city || "").trim() || null;
  const state = (body.state || "").trim() || null;
  const zip = (body.zip || "").trim() || null;

  if (!name) {
    return NextResponse.json({ success: false, error: "Location name is required." }, { status: 400 });
  }
  if (!companyId) {
    return NextResponse.json({ success: false, error: "Please choose a company." }, { status: 400 });
  }

  try {
    // Confirm the company exists before attaching a location to it.
    const { rows: companyRows } = await sql`
      SELECT id FROM companies WHERE id = ${companyId} LIMIT 1;
    `;
    if (companyRows.length === 0) {
      return NextResponse.json({ success: false, error: "That company was not found." }, { status: 400 });
    }

    // Build a unique slug within this company (locations are scoped per company).
    const baseSlug = slugify(name) || "location";
    let slug = baseSlug;
    let suffix = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { rows: existing } = await sql`
        SELECT id FROM locations
        WHERE company_id = ${companyId} AND slug = ${slug}
        LIMIT 1;
      `;
      if (existing.length === 0) break;
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    // Block an exact duplicate location name within the same company.
    const { rows: dupName } = await sql`
      SELECT id FROM locations
      WHERE company_id = ${companyId} AND lower(name) = ${name.toLowerCase()}
      LIMIT 1;
    `;
    if (dupName.length > 0) {
      return NextResponse.json(
        { success: false, error: "That location already exists for this company." },
        { status: 409 }
      );
    }

    const id = crypto.randomUUID();
    await sql`
      INSERT INTO locations (id, company_id, slug, name, address, city, state, zip)
      VALUES (${id}, ${companyId}, ${slug}, ${name}, ${address}, ${city}, ${state}, ${zip});
    `;

    return NextResponse.json({ success: true, id, name });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
