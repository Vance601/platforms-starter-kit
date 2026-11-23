import { logAudit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto from "crypto";
import { parseSaleCustomer, ensureSaleTables, writeSaleRecord } from "@/lib/sale-records";
import { getOrgSettings } from "@/lib/org-settings";
import { getDriverContext } from "@/lib/driver-session";
import { ensureLoggedByDriverColumn, resolveSaleSeller, SELL_WAREHOUSE_HELP } from "@/lib/driver-roles";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const ctx = await getDriverContext(req);
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Not signed in. Please log in again." },
        { status: 401 }
      );
    }
    const driverId = ctx.driverId;
    await ensureLoggedByDriverColumn();

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

    const driver = { id: ctx.driverId, name: ctx.name, company_id: ctx.companyId };

    // The battery must exist, be on_truck, and belong to this company.
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
    if (battery.status !== "on_truck" || !battery.truck_id) {
      return NextResponse.json(
        { success: false, error: `Battery is not on a truck (status: ${battery.status}).` },
        { status: 409 }
      );
    }

    const { rows: truckRows } = await sql`
      SELECT id, truck_number, current_driver_id
      FROM trucks
      WHERE id = ${battery.truck_id}
      LIMIT 1;
    `;
    if (truckRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "The truck for that battery was not found." },
        { status: 409 }
      );
    }
    const truck = truckRows[0];

    if (!ctx.isWarehouse && ctx.truckId !== truck.id) {
      return NextResponse.json(
        { success: false, error: "Battery is not on your truck. Claim the truck first, or use Transfer to move stock." },
        { status: 409 }
      );
    }

    const soldByRaw = typeof body?.soldByDriverId === "string" ? body.soldByDriverId.trim() : "";
    const sellerDecision = resolveSaleSeller({
      sessionDriverId: ctx.driverId,
      isWarehouse: ctx.isWarehouse,
      claimedTruckId: ctx.truckId,
      batteryTruckId: truck.id,
      soldByDriverId: soldByRaw || null,
    });
    if (!sellerDecision.ok) {
      return NextResponse.json({ success: false, error: sellerDecision.error }, { status: 400 });
    }

    let sellerId = sellerDecision.sellerId;
    let sellerName = ctx.name;
    if (sellerId !== ctx.driverId) {
      const { rows: sellerRows } = await sql`
        SELECT id, name, company_id, active, COALESCE(is_warehouse, FALSE) AS is_warehouse
        FROM drivers
        WHERE id = ${sellerId}
        LIMIT 1;
      `;
      const seller = sellerRows[0];
      if (!seller || seller.active === false || seller.company_id !== ctx.companyId) {
        return NextResponse.json(
          { success: false, error: "Pick an active driver at your company." },
          { status: 400 }
        );
      }
      if (seller.is_warehouse === true || seller.is_warehouse === "t" || seller.is_warehouse === "true") {
        return NextResponse.json({ success: false, error: SELL_WAREHOUSE_HELP }, { status: 400 });
      }
      sellerName = String(seller.name);
    } else if (ctx.isWarehouse) {
      return NextResponse.json({ success: false, error: SELL_WAREHOUSE_HELP }, { status: 400 });
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

    // Core disposition. If the customer keeps their old battery there is no
    // core coming back, so an upcharge is owed. The money is collected on a
    // different platform -- this only RECORDS what is owed so it can be
    // reconciled later.
    const coreKept = body.coreKept === true;
    let coreCharge: number | null = null;
    if (coreKept) {
      const raw = body.coreCharge;
      const n = typeof raw === "string" ? parseFloat(raw) : Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { success: false, error: "Enter the core charge amount." },
          { status: 400 }
        );
      }
      // Guard against a slipped decimal point rather than a real figure.
      if (n > 1000) {
        return NextResponse.json(
          { success: false, error: "Core charge looks too high — check the amount." },
          { status: 400 }
        );
      }
      coreCharge = Math.round(n * 100) / 100;
    }

    // Optional VIN-first block (customer + vehicle + warranty). Validated
    // before anything is written; absent on the old sale path.
    const vehicleSale = parseSaleCustomer(body);
    if (typeof vehicleSale === "string") {
      return NextResponse.json({ success: false, error: vehicleSale }, { status: 400 });
    }
    if (vehicleSale) await ensureSaleTables();

    // --- Perform the sale ---
    // 1) Mark the battery sold. Clear truck columns.
    let soldCount: number | null = 0;
    if (isWarranty) {
      ({ rowCount: soldCount } = await sql`
        UPDATE batteries
        SET status = 'sold',
            sold_at = NOW(),
            sold_on_call_number = ${callNumber},
            is_warranty = true,
            warranty_replaces_battery_id = ${validatedReplacesId},
            warranty_note = ${warrantyNote},
            truck_id = NULL,
            current_truck_id = NULL
        WHERE id = ${battery.id} AND status = 'on_truck' AND truck_id = ${truck.id};
      `);
    } else {
      ({ rowCount: soldCount } = await sql`
        UPDATE batteries
        SET status = 'sold',
            sold_at = NOW(),
            sold_on_call_number = ${callNumber},
            truck_id = NULL,
            current_truck_id = NULL
        WHERE id = ${battery.id} AND status = 'on_truck' AND truck_id = ${truck.id};
      `);
    }

    if (!soldCount) {
      return NextResponse.json(
        { success: false, error: "That battery was just sold or moved. Refresh and try again." },
        { status: 409 }
      );
    }

    // The battery has left the truck, so its load can no longer be reviewed
    // in Load Approvals. Close out any still-pending load so it doesn't linger.
    await sql`
      UPDATE battery_movements
      SET approval_status = 'approved',
          approved_at = NOW(),
          notes = COALESCE(notes, '') || ${` | Auto-approved: sold on call #${callNumber}`}
      WHERE battery_id = ${battery.id}
        AND to_status = 'on_truck'
        AND approval_status = 'pending';
    `;

    // 2) Log the movement (on_truck -> sold).
    //    driver_id references the drivers table (confirmed via FK). This is the
    //    column all reports read for driver attribution. Do NOT use to_driver_id
    //    here — that column FK-references users, not drivers.
    const movementId = crypto.randomUUID();
    const loggedSuffix = sellerId !== ctx.driverId ? `, logged by ${ctx.name}` : "";
    const movementNote = isWarranty
      ? `WARRANTY sale on call #${callNumber} by ${sellerName} (truck #${truck.truck_number})` +
        (validatedReplacesId ? ` — replaces battery ${validatedReplacesId}` : ` — replaces (not in system): ${warrantyNote}`) +
        loggedSuffix
      : `Sold on call #${callNumber} by ${sellerName} (truck #${truck.truck_number})` + loggedSuffix;
    await sql`
      INSERT INTO battery_movements
        (id, battery_id, from_status, to_status, from_truck_id, driver_id, logged_by_driver_id, call_reference, notes)
      VALUES
        (${movementId}, ${battery.id}, 'on_truck', 'sold',
         ${truck.id}, ${sellerId}, ${ctx.driverId}, ${callNumber}, ${movementNote});
    `;

    // 3) Create the core record.
    //    Default is 'owed' -- the customer is bringing the old battery back.
    //    If the driver marked the core as kept, the record is written as
    //    'customer_kept' with the upcharge amount in deposit_amount. The
    //    driver's name is written into notes so any disputed figure is
    //    traceable to whoever entered it.
    const coreId = crypto.randomUUID();
    const coreStatus = coreKept ? "customer_kept" : "owed";
    const coreNote = coreKept
      ? `Customer kept core on call #${callNumber}. Core charge $${coreCharge?.toFixed(2)} entered by ${ctx.name} for ${sellerName} (truck #${truck.truck_number}).`
      : `Core owed from ${isWarranty ? "warranty " : ""}sale on call #${callNumber} by ${sellerName}`;

    await sql`
      INSERT INTO core_returns
        (id, battery_id, company_id, location_id, status, deposit_amount, notes)
      VALUES
        (${coreId}, ${battery.id}, ${battery.company_id}, ${battery.location_id},
         ${coreStatus}, ${coreCharge}, ${coreNote});
    `;

    // 4) VIN-first: link customer, vehicle and warranty to this sale.
    let record: Awaited<ReturnType<typeof writeSaleRecord>> | null = null;
    let recordError: string | null = null;
    if (vehicleSale) {
      try {
        const { rows: org } = await sql`
          SELECT c.org_id, bm.code AS grp
          FROM batteries b
          LEFT JOIN companies c ON c.id = b.company_id
          LEFT JOIN battery_models bm ON bm.id = b.battery_model_id
          WHERE b.id = ${battery.id} LIMIT 1;`;
        const orgId = org[0]?.org_id == null ? null : String(org[0].org_id);
        const settings = await getOrgSettings(orgId);
        // The group actually installed comes from the battery itself.
        vehicleSale.batteryGroup = org[0]?.grp ?? vehicleSale.batteryGroup;
        record = await writeSaleRecord({
          input: vehicleSale, orgId, companyId: battery.company_id, batteryId: battery.id,
          movementId, driverId: sellerId, callNumber, isWarranty, timeZone: settings.timezone,
        });
      } catch (e) {
        recordError = e instanceof Error ? e.message : "unknown";
      }
    }

    await logAudit({
      action: isWarranty ? "battery.warranty_install" : "battery.sell", actorType: "driver",
      actorId: ctx.driverId, actorName: ctx.name, companyId: battery.company_id,
      entityType: "battery", entityId: battery.id,
      details: {
        barcode: battery.barcode, callNumber, coreId, coreStatus, coreCharge,
        soldByDriverId: sellerId, soldByName: sellerName, loggedByDriverId: ctx.driverId,
        ...(vehicleSale ? { vin: vehicleSale.vin, saleRecordId: record?.saleRecordId ?? null, recordError } : {}),
      }, req,
    });

    return NextResponse.json({
      success: true,
      message:
        (isWarranty
          ? `Warranty: Battery ${battery.barcode} installed FREE on call #${callNumber}`
          : `Battery ${battery.barcode} sold on call #${callNumber}`) +
        (coreKept
          ? ` — core kept, $${coreCharge?.toFixed(2)} core charge recorded`
          : ` — core owed`),
      battery: { id: battery.id, barcode: battery.barcode, status: "sold", isWarranty },
      callNumber,
      core: { kept: coreKept, charge: coreCharge },
      saleRecord: record,
      ...(recordError
        ? { warning: "Sale recorded, but the customer/warranty details did not save. Tell your manager." }
        : {}),
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
