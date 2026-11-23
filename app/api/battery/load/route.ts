import { logAudit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto from "crypto";
import { getDriverContext } from "@/lib/driver-session";

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

    const body = await req.json();
    const batteryId: string | undefined = body?.batteryId;
    const requestedTruckId = typeof body?.truckId === "string" ? body.truckId.trim() : "";
    if (!batteryId) {
      return NextResponse.json(
        { success: false, error: "No battery selected." },
        { status: 400 }
      );
    }

    let truck: { id: string; truck_number: string; company_id: string } | null = null;

    if (ctx.isWarehouse) {
      if (!requestedTruckId) {
        return NextResponse.json(
          {
            success: false,
            error: "Pick a truck to transfer this battery onto. You do not need to claim it.",
          },
          { status: 400 }
        );
      }
      const { rows: truckRows } = await sql`
        SELECT id, truck_number, company_id
        FROM trucks
        WHERE id = ${requestedTruckId}
          AND company_id = ${ctx.companyId}
          AND active = TRUE
        LIMIT 1;
      `;
      if (!truckRows[0]) {
        return NextResponse.json(
          { success: false, error: "Truck not found." },
          { status: 404 }
        );
      }
      truck = truckRows[0];
    } else {
      const { rows: truckRows } = await sql`
        SELECT id, truck_number, company_id
        FROM trucks
        WHERE current_driver_id = ${ctx.driverId}
        LIMIT 1;
      `;
      if (truckRows.length === 0) {
        return NextResponse.json(
          { success: false, error: "You haven't claimed a truck yet. Claim a truck first, then load batteries." },
          { status: 409 }
        );
      }
      truck = truckRows[0];
    }

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

    if (battery.company_id !== ctx.companyId) {
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

    // current_driver_id on the truck is intentionally NOT changed here.
    // Warehouse staff can load a truck without becoming its claimed driver.
    const { rowCount: loaded } = await sql`
      UPDATE batteries
      SET status = 'on_truck',
          truck_id = ${truck!.id},
          current_truck_id = ${truck!.id}
      WHERE id = ${battery.id}
        AND status = 'in_warehouse'
        AND truck_id IS NULL;
    `;
    if (!loaded) {
      return NextResponse.json(
        { success: false, error: "That battery was just loaded by someone else." },
        { status: 409 }
      );
    }

    const movementId = crypto.randomUUID();
    const note = ctx.isWarehouse
      ? `Transferred onto truck #${truck!.truck_number} by ${ctx.name} (warehouse)`
      : `Loaded onto truck #${truck!.truck_number} by ${ctx.name}`;
    // Warehouse transfers are auto-approved (the warehouse person is the verifier).
    const approval = ctx.isWarehouse ? "approved" : "pending";

    await sql`
      INSERT INTO battery_movements
        (id, battery_id, from_status, to_status, to_truck_id, driver_id, approval_status, approved_at, notes)
      VALUES
        (${movementId}, ${battery.id}, 'in_warehouse', 'on_truck',
         ${truck!.id}, ${ctx.driverId}, ${approval},
         ${ctx.isWarehouse ? new Date().toISOString() : null},
         ${note});
    `;

    await logAudit({
      action: ctx.isWarehouse ? "battery.transfer" : "battery.load",
      actorType: "driver",
      actorId: ctx.driverId,
      actorName: ctx.name,
      companyId: ctx.companyId,
      entityType: "battery",
      entityId: battery.id,
      details: { barcode: battery.barcode, truckNumber: truck!.truck_number, movementId, warehouse: ctx.isWarehouse },
      req,
    });

    return NextResponse.json({
      success: true,
      message: ctx.isWarehouse
        ? `Battery ${battery.barcode} transferred onto truck #${truck!.truck_number}`
        : `Battery ${battery.barcode} loaded onto truck #${truck!.truck_number}`,
      battery: { id: battery.id, barcode: battery.barcode, status: "on_truck" },
      truck: { id: truck!.id, truck_number: truck!.truck_number },
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
