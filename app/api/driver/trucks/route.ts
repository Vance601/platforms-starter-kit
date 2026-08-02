// app/api/driver/trucks/route.ts
// Truck list for the driver "Claim a Truck" screen.
//
// The page used to call /api/trucks, which is an owner/manager route gated by
// getCurrentUser() + a role check. getCurrentUser() does not read the
// driver_session cookie at all, so a signed-in driver always got 401/403 and
// the page showed "Could not load trucks". It only appeared to work for the
// owner, on the owner's own browser.
//
// This route authenticates the driver_session cookie directly (same scheme as
// battery/sellable and battery/loadable) and returns only trucks belonging to
// that driver's company.

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Verify the session cookie set by auth-driver login.
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
    const token = req.cookies.get("driver_session")?.value;
    const driverId = verifySession(token);
    if (!driverId) {
      return NextResponse.json(
        { success: false, error: "Not signed in. Please log in again." },
        { status: 401 }
      );
    }

    const { rows: driverRows } = await sql`
      SELECT id, name, company_id
      FROM drivers
      WHERE id = ${driverId} AND active = TRUE
      LIMIT 1;
    `;
    if (driverRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Driver not found or inactive. See a manager." },
        { status: 404 }
      );
    }
    const driver = driverRows[0];

    // Active trucks in this driver's company only, with who holds each one.
    const { rows: trucks } = await sql`
      SELECT
        t.id,
        t.truck_number,
        t.year_model,
        t.vin_last5,
        t.current_driver_id,
        d.name        AS current_driver_name,
        c.slug        AS company
      FROM trucks t
      JOIN companies c ON c.id = t.company_id
      LEFT JOIN drivers d ON d.id = t.current_driver_id
      WHERE t.active = TRUE
        AND t.company_id = ${driver.company_id}
      ORDER BY t.truck_number ASC;
    `;

    return NextResponse.json({
      success: true,
      trucks,
      driver: { id: driver.id, name: driver.name, company_id: driver.company_id },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
