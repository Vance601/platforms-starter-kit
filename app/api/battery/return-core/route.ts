import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Verify the session cookie set by auth-driver login.
// (Copied verbatim from app/api/battery/sell/route.ts)
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

// ---- GET: list this driver's company's SOLD batteries (eligible for core return) ----
export async function GET(req: NextRequest) {
  const token = req.cookies.get("driver_session")?.value;
  const driverId = verifySession(token);
  if (!driverId) {
    return NextResponse.json(
      { success: false, error: "Not signed in. Please log in again." },
      { status: 401 }
    );
  }

  // Look up the driver's company_id
  const driverRow = await sql`
    SELECT company_id FROM drivers WHERE id = ${driverId} LIMIT 1
  `;
  if (driverRow.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Driver not found" },
      { status: 404 }
    );
  }
  const companyId = driverRow.rows[0].company_id;

  // Sold batteries for this company (eligible for core return)
  const batteries = await sql`
    SELECT id, barcode, serial_number, sold_on_call_number, sold_at
    FROM batteries
    WHERE company_id = ${companyId}
      AND status = 'sold'
    ORDER BY sold_at DESC NULLS LAST, created_at DESC
  `;

  return NextResponse.json({ success: true, batteries: batteries.rows });
}

// ---- POST: mark one SOLD battery -> returned_core + log movement (FK-safe) ----
export async function POST(req: NextRequest) {
  const token = req.cookies.get("driver_session")?.value;
  const driverId = verifySession(token);
  if (!driverId) {
    return NextResponse.json(
      { success: false, error: "Not signed in. Please log in again." },
      { status: 401 }
    );
  }

  let body: { batteryId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const batteryId = body.batteryId;
  if (!batteryId) {
    return NextResponse.json(
      { success: false, error: "batteryId is required" },
      { status: 400 }
    );
  }

  // Look up the driver's company_id
  const driverRow = await sql`
    SELECT company_id FROM drivers WHERE id = ${driverId} LIMIT 1
  `;
  if (driverRow.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Driver not found" },
      { status: 404 }
    );
  }
  const companyId = driverRow.rows[0].company_id;

  // Fetch the battery, scoped to the driver's company
  const batteryRow = await sql`
    SELECT id, status, current_truck_id, sold_on_call_number, company_id
    FROM batteries
    WHERE id = ${batteryId} AND company_id = ${companyId}
    LIMIT 1
  `;
  if (batteryRow.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Battery not found for your company" },
      { status: 404 }
    );
  }

  const battery = batteryRow.rows[0];

  // Only SOLD batteries can be marked core-returned
  if (battery.status !== "sold") {
    return NextResponse.json(
      { success: false, error: `Battery is '${battery.status}', not 'sold' - cannot return core` },
      { status: 409 }
    );
  }

  const fromStatus = battery.status; // 'sold'
  const toStatus = "returned_core";

  // Update battery status
  await sql`
    UPDATE batteries
    SET status = ${toStatus}
    WHERE id = ${batteryId} AND company_id = ${companyId}
  `;

  // Log movement - FK-SAFE columns only:
  // id, battery_id, from_status, to_status, from_truck_id, driver_id, call_reference, notes
  await sql`
    INSERT INTO battery_movements
      (id, battery_id, from_status, to_status, from_truck_id, driver_id, call_reference, notes)
    VALUES (
      ${crypto.randomUUID()},
      ${batteryId},
      ${fromStatus},
      ${toStatus},
      ${battery.current_truck_id},
      ${driverId},
      ${battery.sold_on_call_number},
      ${"Core returned to MBS"}
    )
  `;

  return NextResponse.json({ success: true, batteryId, status: toStatus });
}
