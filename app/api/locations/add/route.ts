import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Build a URL-safe slug from a name, e.g. "Tucson Main" -> "tucson-main"
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// POST /api/locations/add
// Body: { name, companyId, address?, city?, state?, zip? }
// Inserts a new location scoped to the chosen company. Owner/manager only.
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
    }
    const role = (session.user as { role?: string }).role;
    if (role !== "owner" && role !== "manager") {
      return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const name = (body.name || "").toString().trim();
    const companyId = (body.companyId || "").toString().trim();
    const address = body.address ? body.address.toString().trim() : null;
    const city = body.city ? body.city.toString().trim() : null;
    const state = body.state ? body.state.toString().trim() : null;
    const zip = body.zip ? body.zip.toString().trim() : null;

    if (!name) {
      return NextResponse.json({ success: false, error: "Location name is required." }, { status: 400 });
    }
    if (!companyId) {
      return NextResponse.json({ success: false, error: "Please choose a company." }, { status: 400 });
    }

    // Verify the company exists and is active.
    const company = await sql`SELECT id FROM companies WHERE id = ${companyId} AND active = true LIMIT 1;`;
    if (company.rows.length === 0) {
      return NextResponse.json({ success: false, error: "That company was not found." }, { status: 400 });
    }

    // No duplicate location name within the same company.
    const dup = await sql`
      SELECT id FROM locations
      WHERE company_id = ${companyId} AND lower(name) = ${name.toLowerCase()}
      LIMIT 1;
    `;
    if (dup.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: "A location with that name already exists for this company." },
        { status: 409 }
      );
    }

    const id = crypto.randomUUID();
    let slug = slugify(name);
    if (!slug) slug = id.slice(0, 8);

    // Keep slug unique within the company by suffixing if needed.
    const slugClash = await sql`
      SELECT id FROM locations WHERE company_id = ${companyId} AND slug = ${slug} LIMIT 1;
    `;
    if (slugClash.rows.length > 0) {
      slug = `${slug}-${id.slice(0, 4)}`;
    }

    await sql`
      INSERT INTO locations (id, company_id, slug, name, address, city, state, zip, active)
      VALUES (${id}, ${companyId}, ${slug}, ${name}, ${address}, ${city}, ${state}, ${zip}, true);
    `;

    return NextResponse.json({ success: true, id, name, slug, companyId });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
