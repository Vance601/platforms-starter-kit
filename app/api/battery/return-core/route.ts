import { getOrgSettings } from "@/lib/org-settings";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto from "crypto";
import { getDriverContext } from "@/lib/driver-session";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// A driver may see and resolve a core if they made the sale, or if they
// currently have the sale's truck claimed. Attribution comes from the
// latest on_truck -> sold movement (driver_id + from_truck_id).
function ownedByDriver(
  saleDriverId: string | null,
  saleTruckId: string | null,
  driverId: string,
  claimedTruckId: string | null,
) {
  if (saleDriverId && saleDriverId === driverId) return true;
  if (claimedTruckId && saleTruckId && saleTruckId === claimedTruckId) return true;
  return false;
}

export async function GET(req: NextRequest) {
  try {
    return await getCores(req);
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

async function getCores(req: NextRequest) {
  const ctx = await getDriverContext(req);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Not signed in. Please log in again." },
      { status: 401 }
    );
  }
  const { driverId, companyId, truckId: claimedTruckId } = ctx;

  const { rows: truckRows } = claimedTruckId
    ? await sql`SELECT id, truck_number FROM trucks WHERE id = ${claimedTruckId} LIMIT 1`
    : { rows: [] as { id: string; truck_number: string }[] };
  const claimedTruck = truckRows[0] || null;

  // Owed cores for this company, attributed via the sale movement.
  const cores = await sql`
    SELECT
      cr.id            AS core_id,
      cr.battery_id    AS battery_id,
      cr.status        AS core_status,
      b.barcode        AS barcode,
      b.serial_number  AS serial_number,
      b.sold_on_call_number AS sold_on_call_number,
      b.sold_at        AS sold_at,
      sm.driver_id     AS sale_driver_id,
      sm.from_truck_id AS sale_truck_id,
      d.name           AS sale_driver_name,
      t.truck_number   AS sale_truck_number
    FROM core_returns cr
    JOIN batteries b ON b.id = cr.battery_id
    LEFT JOIN LATERAL (
      SELECT m.driver_id, m.from_truck_id
      FROM battery_movements m
      WHERE m.battery_id = cr.battery_id AND m.to_status = 'sold'
      ORDER BY m.occurred_at DESC
      LIMIT 1
    ) sm ON true
    LEFT JOIN drivers d ON d.id = sm.driver_id
    LEFT JOIN trucks t ON t.id = sm.from_truck_id
    WHERE cr.company_id = ${companyId}
      AND cr.status = 'owed'
    ORDER BY b.sold_at DESC NULLS LAST
  `;

  const visible = cores.rows.filter((row) =>
    ownedByDriver(row.sale_driver_id, row.sale_truck_id, driverId, claimedTruckId)
  );

  const { coreCharge } = await getOrgSettings(ctx.orgId);
  return NextResponse.json({
    success: true,
    cores: visible,
    claimedTruck,
    defaultCoreCharge: coreCharge,
  });
}

// ---- POST: resolve one owed core ----
// body: { coreId, decision: "returned" | "kept", chargeAmount? }
export async function POST(req: NextRequest) {
  const ctx = await getDriverContext(req);
  if (!ctx) {
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

  let charge = 0;
  if (decision === "kept") {
    const raw = body.chargeAmount;
    const parsed = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
    if (!Number.isFinite(parsed) || parsed < 0) {
      return NextResponse.json(
        { success: false, error: "Enter the core charge amount." },
        { status: 400 }
      );
    }
    charge = parsed;
  }

  const { driverId, name: driverName, companyId, truckId: claimedTruckId } = ctx;

  const coreRow = await sql`
    SELECT
      cr.id, cr.battery_id, cr.status, cr.company_id,
      sm.driver_id AS sale_driver_id,
      sm.from_truck_id AS sale_truck_id
    FROM core_returns cr
    LEFT JOIN LATERAL (
      SELECT m.driver_id, m.from_truck_id
      FROM battery_movements m
      WHERE m.battery_id = cr.battery_id AND m.to_status = 'sold'
      ORDER BY m.occurred_at DESC
      LIMIT 1
    ) sm ON true
    WHERE cr.id = ${coreId} AND cr.company_id = ${companyId}
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
  if (!ownedByDriver(core.sale_driver_id, core.sale_truck_id, driverId, claimedTruckId)) {
    return NextResponse.json(
      { success: false, error: "That core belongs to another driver or truck." },
      { status: 403 }
    );
  }

  const batteryId = core.battery_id;

  const batteryRow = await sql`
    SELECT id, status, current_truck_id, sold_on_call_number
    FROM batteries
    WHERE id = ${batteryId} AND company_id = ${companyId}
    LIMIT 1
  `;
  const battery = batteryRow.rows[0] || null;

  if (decision === "returned") {
    await sql`
      UPDATE core_returns
      SET status = 'returned',
          returned_at = NOW(),
          notes = COALESCE(notes, '') || ${` | Returned to supplier by ${driverName}`}
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
          ${battery.sold_on_call_number}, ${"Core returned to supplier"}
        )
      `;
    }

    return NextResponse.json({ success: true, coreId, status: "returned" });
  }

  await sql`
    UPDATE core_returns
    SET status = 'customer_kept',
        deposit_amount = ${charge},
        returned_at = NOW(),
        notes = COALESCE(notes, '') || ${` | Customer kept core — charge $${charge.toFixed(2)} (recorded by ${driverName})`}
    WHERE id = ${coreId} AND company_id = ${companyId}
  `;

  return NextResponse.json({
    success: true,
    coreId,
    status: "customer_kept",
    chargeAmount: charge,
  });
}
