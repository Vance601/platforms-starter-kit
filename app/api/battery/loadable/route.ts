import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Verify the session cookie set by auth-driver login.
// (Copied from /api/transfer so both routes agree on driver identity.)
function verifySession(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [driverId, expiryStr, sig] = parts;
  const secret = process.env.MIGRATE_SECRET || "";
  const expected = crypto.scryptSync(`${driverId}.${expiryStr}`, secret, 32).toString("hex");
  if (sig !== expected) return null;
  if (Date.now() > Number(expiryStr)) return null;
  return driverId;
}

export async function GET(req: NextRequest) {
  try {
    // Who is asking — from the verified session cookie.
    const token = req.cookies.get("driver_session")?.value;
    const driverId = verifySession(token);
    if (!driverId) {
      return NextResponse.json(
        { success: false, error: "Not signed in. Please log in again." },
        { status: 401 }
      );
    }

    // Look up the driver (name + company) so we can scope batteries to their company.
    const { rows: driverRows } = await sql`
      SELECT id, name, company_id
      FROM drivers
      WHERE id = ${driverId};
    `;
    if (driverRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Driver not found." },
        { status: 404 }
      );
    }
    const driver = driverRows[0];

    // Find the truck this driver currently has claimed (Phase 3 claim sets current_driver_id).
    const { rows: truckRows } = await sql`
      SELECT id, truck_number
      FROM trucks
      WHERE current_driver_id = ${driverId}
      LIMIT 1;
    `;
    const claimedTruck = truckRows.length > 0 ? truckRows[0] : null;

    // Batteries available to load: in_warehouse, same company, not already on a truck.
    const { rows: batteries } = await sql`
      SELECT id, barcode, serial_number, status
      FROM batteries
      WHERE status = 'in_warehouse'
        AND company_id = ${driver.company_id}
        AND truck_id IS NULL
      ORDER BY barcode;
    `;

    return NextResponse.json({
      success: true,
      driver: { id: driver.id, name: driver.name, company_id: driver.company_id },
      claimedTruck, // null if they haven't claimed a truck yet
      batteries,
    });
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
