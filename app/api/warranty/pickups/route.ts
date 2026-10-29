import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { requireOrg } from "@/lib/require-org";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireOrg();
  if (!g.ok) return g.response;
  const orgId = g.orgId;

  const { rows } = await sql`
    SELECT wp.id, wp.memo_number, wp.pickup_date, wp.total_units,
           COALESCE(l.name, '') AS location_name
    FROM warranty_pickups wp
    LEFT JOIN locations l ON l.id = wp.location_id
    WHERE wp.company_id IN (SELECT id FROM companies WHERE org_id = ${orgId})
    ORDER BY wp.created_at DESC
    LIMIT 100;
  `;

  return NextResponse.json({ pickups: rows });
}
