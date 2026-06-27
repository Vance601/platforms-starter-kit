import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isSignedIn } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Live list of companies for pickers (e.g. Add Driver). Auth-gated, same
// pattern as the other routes. Stays correct as companies are added/changed.
export async function GET() {
  try {
    const signedIn = await isSignedIn();
    if (!signedIn) {
      return NextResponse.json(
        { success: false, error: "Not signed in." },
        { status: 401 }
      );
    }

    const { rows } = await sql`
      SELECT id, name
      FROM companies
      ORDER BY name ASC;
    `;

    const companies = rows.map((r) => ({
      id: r.id as string,
      name: (r.name as string) || "Unnamed company",
    }));

    return NextResponse.json({ success: true, companies });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
