import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getDriverContext } from "@/lib/driver-session";
import { ensureDriverWarehouseFlag, SELL_WAREHOUSE_HELP } from "@/lib/driver-roles";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const ctx = await getDriverContext(req);
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Not signed in. Please log in again." },
        { status: 401 }
      );
    }
    await ensureDriverWarehouseFlag();

    const { rows: truckRows } = await sql`
      SELECT id, truck_number
      FROM trucks
      WHERE current_driver_id = ${ctx.driverId}
      LIMIT 1;
    `;
    const claimedTruck = truckRows.length > 0 ? truckRows[0] : null;

    let batteries: Record<string, unknown>[] = [];
    if (ctx.isWarehouse) {
      const { rows } = await sql`
        SELECT b.id, b.barcode, b.serial_number, b.status, b.truck_id,
               bm.code AS model_code, t.truck_number,
               d.name AS current_driver_name
        FROM batteries b
        LEFT JOIN battery_models bm ON bm.id = b.battery_model_id
        LEFT JOIN trucks t ON t.id = b.truck_id
        LEFT JOIN drivers d ON d.id = t.current_driver_id
        WHERE b.status = 'on_truck'
          AND b.truck_id IS NOT NULL
          AND b.company_id = ${ctx.companyId}
        ORDER BY t.truck_number, b.barcode;
      `;
      batteries = rows;
    } else if (claimedTruck) {
      const { rows } = await sql`
        SELECT b.id, b.barcode, b.serial_number, b.status, b.truck_id,
               bm.code AS model_code, t.truck_number,
               d.name AS current_driver_name
        FROM batteries b
        LEFT JOIN battery_models bm ON bm.id = b.battery_model_id
        LEFT JOIN trucks t ON t.id = b.truck_id
        LEFT JOIN drivers d ON d.id = t.current_driver_id
        WHERE b.status = 'on_truck'
          AND b.truck_id = ${claimedTruck.id}
          AND b.company_id = ${ctx.companyId}
        ORDER BY b.barcode;
      `;
      batteries = rows;
    }

    let drivers: { id: string; name: string }[] = [];
    if (ctx.isWarehouse) {
      const { rows } = await sql`
        SELECT id, name
        FROM drivers
        WHERE company_id = ${ctx.companyId}
          AND active = TRUE
          AND COALESCE(is_warehouse, FALSE) = FALSE
        ORDER BY name;
      `;
      drivers = rows.map((r) => ({ id: String(r.id), name: String(r.name) }));
    }

    return NextResponse.json({
      success: true,
      driver: {
        id: ctx.driverId,
        name: ctx.name,
        company_id: ctx.companyId,
        isWarehouse: ctx.isWarehouse,
      },
      isWarehouse: ctx.isWarehouse,
      sellHelp: ctx.isWarehouse ? SELL_WAREHOUSE_HELP : null,
      claimedTruck,
      batteries,
      drivers,
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
