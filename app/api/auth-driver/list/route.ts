import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Returns active drivers for the login name-picker.
// Only id + name + company — NO pin_hash, nothing sensitive.
// Safe for a not-yet-logged-in driver to call.
export async function GET() {
  try {
    const { rows } = await sql`
      SELECT drivers.id,
             drivers.name,
             companies.slug AS company
      FROM drivers
      JOIN companies ON companies.id = drivers.company_id
      WHERE drivers.active = TRUE
      ORDER BY drivers.name;
    `;

    return NextResponse.json({ success: true, drivers: rows });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
