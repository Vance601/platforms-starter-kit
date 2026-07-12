import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Returns active trucks for the transfer/claim screen, scoped to the caller's org.
// Includes who currently holds each truck (for the handoff display).
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
    }
    if (user.role !== "owner" && user.role !== "manager") {
      return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
    }
    if (!user.orgId) {
      return NextResponse.json({ success: true, trucks: [] });
    }

    const { rows } = await sql`
      SELECT trucks.id,
             trucks.truck_number,
             trucks.year_model,
             trucks.vin_last5,
             trucks.capacity,
             trucks.current_driver_id,
             drivers.name AS current_driver_name,
             companies.slug AS company
      FROM trucks
      JOIN companies ON companies.id = trucks.company_id
      LEFT JOIN drivers ON drivers.id = trucks.current_driver_id
      WHERE trucks.active = TRUE
        AND companies.org_id = ${user.orgId}
      ORDER BY trucks.truck_number;
    `;

    return NextResponse.json({ success: true, trucks: rows });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
