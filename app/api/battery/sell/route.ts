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

    // Warranty fields (all optional — only present on a warranty sale).
    const isWarranty: boolean = body?.isWarranty === true;
    const replacesBatteryIdRaw: string | undefined = body?.replacesBatteryId;
    const replacesBatteryId = (replacesBatteryIdRaw || "").trim() || null;
    const warrantyNoteRaw: string | undefined = body?.warrantyNote;
    const warrantyNote = (warrantyNoteRaw || "").trim() || null;

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

    // On a warranty sale, require EITHER a linked failed battery OR a note ('other / not in system').
    if (isWarranty && !replacesBatteryId && !warrantyNote) {
      return NextResponse.json(
        { success: false, error: "For a warranty, pick the failed battery or note it's not in the system." },
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
      SELECT id, barcode, status, company_id, location_id, truck_id
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

    // If a failed battery was picked, validate it: must be a sold battery in this company.
    let validatedReplacesId: string | null = null;
    if (isWarranty && replacesBatteryId) {
      const { rows: failedRows } = await sql`
        SELECT id, status, company_id
        FROM batteries
        WHERE id = ${replacesBatteryId};
      `;
      if (failedRows.length === 0) {
        return NextResponse.json(
          { success: false, error: "The failed battery you selected was not found." },
          { status: 404 }
        );
      }
      const failed = failedRows[0];
      if (failed.company_id !== driver.company_id) {
        return NextResponse.json(
          { success: false, error: "The failed battery belongs to a different company." },
          { status: 403 }
        );
      }
      if (failed.status !== "sold") {
        return NextResponse.json(
          { success: false, error: "The failed battery you selected is not marked as sold." },
          { status: 409 }
        );
      }
      validatedReplacesId = failed.id;
    }

    // --- Perform the sale ---
    // 1) Mark the battery sold. Clear truck columns.
    if (isWarranty) {
      await sql`
        UPDATE batteries
        SET status = 'sold',
            sold_at = NOW(),
            sold_on_call_number = ${callNumber},
            is_warranty = true,
            warranty_replaces_battery_id = ${validatedReplacesId},
            warranty_note = ${warrantyNote},
            truck_id = NULL,
            current_truck_id = NULL
        WHERE id = ${battery.id};
      `;
    } else {
      await sql`
        UPDATE batteries
        SET status = 'sold',
            sold_at = NOW(),
            sold_on_call_number = ${callNumber},
            truck_id = NULL,
            current_truck_id = NULL
        WHERE id = ${battery.id};
      `;
    }

    // 2) Log the movement (on_truck -> sold).
    //    driver_id references the drivers table (confirmed via FK). This is the
    //    column all reports read for driver attribution. Do NOT use to_driver_id
    //    here — that column FK-references users, not drivers.
    const movementId = crypto.randomUUID();
    const movementNote = isWarranty
      ? `WARRANTY sale on call #${callNumber} by ${driver.name} (truck #${truck.truck_number})` +
        (validatedReplacesId ? ` — replaces battery ${validatedReplacesId}` : ` — replaces (not in system): ${warrantyNote}`)
      : `Sold on call #${callNumber} by ${driver.name} (truck #${truck.truck_number})`;
    await sql`
      INSERT INTO battery_movements
        (id, battery_id, from_status, to_status, from_truck_id, driver_id, call_reference, notes)
      VALUES
        (${movementId}, ${battery.id}, 'on_truck', 'sold',
         ${truck.id}, ${driverId}, ${callNumber}, ${movementNote});
    `;

    // 3) Create the OWED core record. Both regular AND warranty sales owe a core.
    const coreId = crypto.randomUUID();
    await sql`
      INSERT INTO core_returns
        (id, battery_id, company_id, location_id, status, notes)
      VALUES
        (${coreId}, ${battery.id}, ${battery.company_id}, ${battery.location_id},
         'owed',
         ${`Core owed from ${isWarranty ? "warranty " : ""}sale on call #${callNumber} by ${driver.name}`});
    `;

    return NextResponse.json({
      success: true,
      message: isWarranty
        ? `Warranty: Battery ${battery.barcode} installed FREE on call #${callNumber}`
        : `Battery ${battery.barcode} sold on call #${callNumber}`,
      battery: { id: battery.id, barcode: battery.barcode, status: "sold", isWarranty },
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
