import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isSignedIn } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const signedIn = await isSignedIn();
  if (!signedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { rows } = await sql`
    SELECT wp.id, wp.memo_number, wp.pickup_date, wp.total_units,
           COALESCE(l.name, '') AS location_name
    FROM warranty_pickups wp
    LEFT JOIN locations l ON l.id = wp.location_id
    ORDER BY wp.created_at DESC
    LIMIT 100;
  `;

  return NextResponse.json({ pickups: rows });
}
