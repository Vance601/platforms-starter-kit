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

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("driver_session")?.value;
    const driverId = verifySession(token);
    if (!driverId) {
      return NextResponse.json(
        { success: false, error: "Not signed in. Please log in again." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const batteryId: string | undefined = body?.batteryId;
    const callNumberRaw: string | undefined = body?.callNumber;
    const callNumber = (callNumberRaw || "").trim();

    if (!batteryId) {
      return NextResponse.json(
        { success: false, error: "No battery selected." },
        { status: 400 }
      );
    }
    if (!callNumber) {
      return NextResponse.json(
        { success: false, error: "A call number is required to record a sale." },
        { status: 400 }
      );
    }

    // Driver + company.
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

    // The driver's claimed truck — the battery being sold must be on it.
    const { rows: truckRows } = await sql`
      SELECT id, truck_number
      FROM trucks
      WHERE current_driver_id = ${driverId}
      LIMIT 1;
    `;
    if (truckRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "You haven't claimed a truck. Claim your truck first." },
        { status: 409 }
      );
    }
    const truck = truckRows[0];

    // The battery must exist, be on_truck, on THIS driver's truck, same company.
    const { rows: batteryRows } = await sql`
      SELECT id, barcode, status, company_id, truck_id
      FROM batteries
      WHERE id = ${batteryId};
    `;
    if (batteryRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Battery not found." },
        { status: 404 }
      );
    }
    const battery = batteryRows[0];

    if (battery.company_id !== driver.company_id) {
      return NextResponse.json(
        { success: false, error: "That battery belongs to a different company." },
        { status: 403 }
      );
    }
    if (battery.status !== "on_truck" || battery.truck_id !== truck.id) {
      return NextResponse.json(
        { success: false, error: `Battery is not on your truck (status: ${battery.status}).` },
        { status: 409 }
      );
    }

    // --- Perform the sale ---
    // 1) Mark the battery sold. Clear the truck columns (it's now in a customer's vehicle).
    //    NOTE: sold_by_id is intentionally NOT set — it references users, not drivers.
    //    The seller is captured on the movement row's driver_id (-> drivers).
    await sql`
      UPDATE batteries
      SET status = 'sold',
          sold_at = NOW(),
          sold_on_call_number = ${callNumber},
          truck_id = NULL,
          current_truck_id = NULL
      WHERE id = ${battery.id};
    `;

    // 2) Log the movement (on_truck -> sold). id has no default, so we generate it.
    //    FK-safe columns only: driver_id -> drivers, from_truck_id -> trucks.
    //    call_reference stores the call number on the movement record too.
    const movementId = crypto.randomUUID();
    await sql`
      INSERT INTO battery_movements
        (id, battery_id, from_status, to_status, from_truck_id, driver_id, call_reference, notes)
      VALUES
        (${movementId}, ${battery.id}, 'on_truck', 'sold',
         ${truck.id}, ${driverId}, ${callNumber},
         ${`Sold on call #${callNumber} by ${driver.name} (truck #${truck.truck_number})`});
    `;

    return NextResponse.json({
      success: true,
      message: `Battery ${battery.barcode} sold on call #${callNumber}`,
      battery: { id: battery.id, barcode: battery.barcode, status: "sold" },
      callNumber,
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
