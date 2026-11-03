import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { requireOrg } from "@/lib/require-org";

export const dynamic = "force-dynamic";

// The signed-in user's organization display name (for headers/titles).
export async function GET() {
  const g = await requireOrg();
  if (!g.ok) return g.response;
  const { rows } = await sql`SELECT name FROM organizations WHERE id::text = ${g.orgId} LIMIT 1`;
  return NextResponse.json({ success: true, name: rows[0]?.name ?? null });
}
