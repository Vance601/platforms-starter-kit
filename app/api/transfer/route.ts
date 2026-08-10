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
    // Who is claiming — from the verified session cookie.
    const token = req.cookies.get("driver_session")?.value;
    const driverId = verifySession(token);
    if (!driverId) {
      return NextResponse.json(
        { success: false, error: "Not signed in" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    let truckId: string | undefined = body.truckId;
    // Scanned windshield QR, e.g. "DG-TRUCK-125". The truck number is encoded
    // rather than the UUID so it is human-readable off the sticker and can be
    // typed if the label is damaged.
    const truckCode: string | undefined = body.truckCode;
    // The driver has seen who currently holds the truck and chose to take it.
    const confirmTakeover: boolean = body.confirmTakeover === true;

    // Which company this driver belongs to - a scanned code must resolve
    // inside it, so a code from another customer cannot claim anything here.
    const { rows: meRows } = await sql`
      SELECT company_id FROM drivers WHERE id = ${driverId} AND active = TRUE LIMIT 1;
    `;
    if (meRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Driver not found or inactive. See a manager." },
        { status: 404 }
      );
    }
    const myCompanyId = meRows[0].company_id;

    if (!truckId && truckCode) {
      const num = String(truckCode)
        .trim()
        .toUpperCase()
        .replace(/^DG-TRUCK-/, "")
        .replace(/^TRUCK-/, "")
        .replace(/^#/, "");

      const { rows: found } = await sql`
        SELECT id FROM trucks
        WHERE upper(truck_number) = ${num}
          AND company_id = ${myCompanyId}
          AND active = TRUE
        LIMIT 1;
      `;
      if (found.length === 0) {
        return NextResponse.json(
          { success: false, error: `No truck ${num} at your company.` },
          { status: 404 }
        );
      }
      truckId = found[0].id;
    }

    if (!truckId) {
      return NextResponse.json(
        { success: false, error: "truckId or truckCode is required" },
        { status: 400 }
      );
    }

    // Load the truck (and who currently holds it).
    const { rows: truckRows } = await sql`
      SELECT id, truck_number, current_driver_id
      FROM trucks
      WHERE id = ${truckId} AND active = TRUE
      LIMIT 1;
    `;
    const truck = truckRows[0];
    if (!truck) {
      return NextResponse.json(
        { success: false, error: "Truck not found or inactive" },
        { status: 404 }
      );
    }

    // Re-scan of own truck — no-op success, no duplicate shift.
    if (truck.current_driver_id === driverId) {
      return NextResponse.json({
        success: true,
        alreadyHeld: true,
        message: `You already have Truck #${truck.truck_number}`,
        truck: { id: truck.id, truck_number: truck.truck_number },
      });
    }

    let autoEndedFrom: string | null = null;

    // Hybrid handoff: if someone else holds it, auto-end their open shift.
    if (truck.current_driver_id) {
      const { rows: prevRows } = await sql`
        UPDATE truck_shifts
        SET ended_at = NOW(), auto_ended = TRUE
        WHERE truck_id = ${truckId}
          AND driver_id = ${truck.current_driver_id}
          AND ended_at IS NULL
        RETURNING driver_id;
      `;
      if (prevRows.length > 0) autoEndedFrom = truck.current_driver_id;
    }

    // Also close any stale open shift this driver left on another truck —
    // a driver can only be on one truck at a time.
    await sql`
      UPDATE truck_shifts
      SET ended_at = NOW(), auto_ended = TRUE
      WHERE driver_id = ${driverId} AND ended_at IS NULL;
    `;

    // FIX: release any OTHER truck this driver still holds. Without this, the
    // driver's previous truck keeps current_driver_id = this driver, so the
    // driver shows up as the current holder of two trucks at once.
    await sql`
      UPDATE trucks
      SET current_driver_id = NULL, updated_at = NOW()
      WHERE current_driver_id = ${driverId} AND id <> ${truckId};
    `;

    // Assign the truck to the claiming driver.
    await sql`
      UPDATE trucks
      SET current_driver_id = ${driverId}, updated_at = NOW()
      WHERE id = ${truckId};
    `;

    // Open a new shift for the claiming driver.
    await sql`
      INSERT INTO truck_shifts (truck_id, driver_id)
      VALUES (${truckId}, ${driverId});
    `;

    return NextResponse.json({
      success: true,
      claimed: true,
      message: `Truck #${truck.truck_number} is now yours`,
      truck: { id: truck.id, truck_number: truck.truck_number },
      autoEndedPreviousDriver: autoEndedFrom !== null,
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
