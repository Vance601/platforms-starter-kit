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

export async function POST(req: NextRequest) {
  try {
    // Who is loading — from the verified session cookie (not the body; can't be spoofed).
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
    if (!batteryId) {
      return NextResponse.json(
        { success: false, error: "No battery selected." },
        { status: 400 }
      );
    }

    // Driver + their company.
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

    // The driver MUST have a claimed truck — battery loads onto that truck automatically.
    const { rows: truckRows } = await sql`
      SELECT id, truck_number, company_id
      FROM trucks
      WHERE current_driver_id = ${driverId}
      LIMIT 1;
    `;
    if (truckRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "You haven't claimed a truck yet. Claim a truck first, then load batteries." },
        { status: 409 }
      );
    }
    const truck = truckRows[0];

    // The battery must exist, be in_warehouse, and belong to the driver's company.
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
    if (battery.status !== "in_warehouse" || battery.truck_id !== null) {
      return NextResponse.json(
        { success: false, error: `Battery is not available to load (status: ${battery.status}).` },
        { status: 409 }
      );
    }

    // --- Perform the load ---
    // 1) Flip the battery onto the truck.
    //    NOTE: current_driver_id is intentionally NOT set here — that column
    //    references the users table, not drivers. The driver linkage is captured
    //    on the movement row (driver_id -> drivers) and via the truck.
    await sql`
      UPDATE batteries
      SET status = 'on_truck',
          truck_id = ${truck.id},
          current_truck_id = ${truck.id}
      WHERE id = ${battery.id};
    `;

    // 2) Log the movement (in_warehouse -> on_truck). id has no default, so we generate it.
    //    Only columns whose FKs resolve correctly are populated:
    //      driver_id   -> drivers (the loading driver)   ✅
    //      to_truck_id -> trucks  (the destination truck) ✅
    //    (to_driver_id / recorded_by_id reference users and are left NULL.)
    const movementId = crypto.randomUUID();
    await sql`
      INSERT INTO battery_movements
        (id, battery_id, from_status, to_status, to_truck_id, driver_id, notes)
      VALUES
        (${movementId}, ${battery.id}, 'in_warehouse', 'on_truck',
         ${truck.id}, ${driverId},
         ${`Loaded onto truck #${truck.truck_number} by ${driver.name}`});
    `;

    return NextResponse.json({
      success: true,
      message: `Battery ${battery.barcode} loaded onto truck #${truck.truck_number}`,
      battery: { id: battery.id, barcode: battery.barcode, status: "on_truck" },
      truck: { id: truck.id, truck_number: truck.truck_number },
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
