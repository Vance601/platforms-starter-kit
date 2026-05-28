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

// ---- GET: list this driver's company's OWED cores (from the core_returns ledger) ----
export async function GET(req: NextRequest) {
  const token = req.cookies.get("driver_session")?.value;
  const driverId = verifySession(token);
  if (!driverId) {
    return NextResponse.json(
      { success: false, error: "Not signed in. Please log in again." },
      { status: 401 }
    );
  }

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

  // Owed cores for this company, joined to the battery for barcode/call display.
  const cores = await sql`
    SELECT
      cr.id            AS core_id,
      cr.battery_id    AS battery_id,
      cr.status        AS core_status,
      b.barcode        AS barcode,
      b.serial_number  AS serial_number,
      b.sold_on_call_number AS sold_on_call_number,
      b.sold_at        AS sold_at
    FROM core_returns cr
    JOIN batteries b ON b.id = cr.battery_id
    WHERE cr.company_id = ${companyId}
      AND cr.status = 'owed'
    ORDER BY b.sold_at DESC NULLS LAST
  `;

  return NextResponse.json({ success: true, cores: cores.rows });
}

// ---- POST: resolve one owed core ----
// body: { coreId, decision: "returned" | "kept", chargeAmount? }
//  - "returned" -> core came back to MBS; battery status -> returned_core
//  - "kept"     -> customer kept it; record charge; battery stays 'sold'
export async function POST(req: NextRequest) {
  const token = req.cookies.get("driver_session")?.value;
  const driverId = verifySession(token);
  if (!driverId) {
    return NextResponse.json(
      { success: false, error: "Not signed in. Please log in again." },
      { status: 401 }
    );
  }

  let body: { coreId?: string; decision?: string; chargeAmount?: number | string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const coreId = body.coreId;
  const decision = body.decision;
  if (!coreId) {
    return NextResponse.json(
      { success: false, error: "coreId is required" },
      { status: 400 }
    );
  }
  if (decision !== "returned" && decision !== "kept") {
    return NextResponse.json(
      { success: false, error: "decision must be 'returned' or 'kept'" },
      { status: 400 }
    );
  }

  // Parse charge (only meaningful for 'kept'). Default to 25 if missing/invalid.
  let charge = 25;
  if (decision === "kept") {
    const raw = body.chargeAmount;
    const parsed = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
    if (!isNaN(parsed) && parsed >= 0) {
      charge = parsed;
    }
  }

  const driverRow = await sql`
    SELECT id, name, company_id FROM drivers WHERE id = ${driverId} LIMIT 1
  `;
  if (driverRow.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Driver not found" },
      { status: 404 }
    );
  }
  const driver = driverRow.rows[0];
  const companyId = driver.company_id;

  // Fetch the core record, scoped to this company, must still be 'owed'.
  const coreRow = await sql`
    SELECT id, battery_id, status, company_id
    FROM core_returns
    WHERE id = ${coreId} AND company_id = ${companyId}
    LIMIT 1
  `;
  if (coreRow.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Core record not found for your company" },
      { status: 404 }
    );
  }
  const core = coreRow.rows[0];
  if (core.status !== "owed") {
    return NextResponse.json(
      { success: false, error: `This core is already '${core.status}'.` },
      { status: 409 }
    );
  }

  const batteryId = core.battery_id;

  // Pull battery for movement logging (truck/call context).
  const batteryRow = await sql`
    SELECT id, status, current_truck_id, sold_on_call_number
    FROM batteries
    WHERE id = ${batteryId} AND company_id = ${companyId}
    LIMIT 1
  `;
  const battery = batteryRow.rows[0] || null;

  if (decision === "returned") {
    // Core came back to MBS. Mark the ledger row returned, and flip the battery
    // to returned_core (same as the old flow did).
    await sql`
      UPDATE core_returns
      SET status = 'returned',
          returned_at = NOW(),
          notes = COALESCE(notes, '') || ${` | Returned to MBS by ${driver.name}`}
      WHERE id = ${coreId} AND company_id = ${companyId}
    `;

    if (battery && battery.status === "sold") {
      await sql`
        UPDATE batteries
        SET status = 'returned_core'
        WHERE id = ${batteryId} AND company_id = ${companyId}
      `;
      await sql`
        INSERT INTO battery_movements
          (id, battery_id, from_status, to_status, from_truck_id, driver_id, call_reference, notes)
        VALUES (
          ${crypto.randomUUID()}, ${batteryId}, 'sold', 'returned_core',
          ${battery.current_truck_id}, ${driverId},
          ${battery.sold_on_call_number}, ${"Core returned to MBS"}
        )
      `;
    }

    return NextResponse.json({ success: true, coreId, status: "returned" });
  }

  // decision === "kept": customer kept the old battery -> charge recorded.
  // Battery stays 'sold' (no core comes back). Charge stored in deposit_amount,
  // for billing records only (does not feed revenue).
  await sql`
    UPDATE core_returns
    SET status = 'customer_kept',
        deposit_amount = ${charge},
        returned_at = NOW(),
        notes = COALESCE(notes, '') || ${` | Customer kept core — charge $${charge.toFixed(2)} (recorded by ${driver.name})`}
    WHERE id = ${coreId} AND company_id = ${companyId}
  `;

  return NextResponse.json({
    success: true,
    coreId,
    status: "customer_kept",
    chargeAmount: charge,
  });
}
