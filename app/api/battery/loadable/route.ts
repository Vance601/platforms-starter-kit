import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getDriverContext } from "@/lib/driver-session";

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

    const { rows: truckRows } = await sql`
      SELECT id, truck_number
      FROM trucks
      WHERE current_driver_id = ${ctx.driverId}
      LIMIT 1;
    `;
    const claimedTruck = truckRows.length > 0 ? truckRows[0] : null;

    const { rows: batteries } = await sql`
      SELECT b.id, b.barcode, b.serial_number, b.status,
             COALESCE(mdl.code, '') AS model_code
      FROM batteries b
      LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
      WHERE b.status = 'in_warehouse'
        AND b.company_id = ${ctx.companyId}
        AND b.truck_id IS NULL
      ORDER BY b.barcode;
    `;

    const { rows: trucks } = await sql`
      SELECT t.id, t.truck_number, d.name AS current_driver_name
      FROM trucks t
      LEFT JOIN drivers d ON d.id = t.current_driver_id
      WHERE t.company_id = ${ctx.companyId} AND t.active = TRUE
      ORDER BY t.truck_number;
    `;

    return NextResponse.json({
      success: true,
      driver: {
        id: ctx.driverId,
        name: ctx.name,
        company_id: ctx.companyId,
        isWarehouse: ctx.isWarehouse,
      },
      isWarehouse: ctx.isWarehouse,
      claimedTruck,
      trucks,
      batteries,
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
