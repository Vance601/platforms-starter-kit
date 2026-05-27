import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { auth } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET — lists for the page: in-warehouse batteries + all trucks.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Not signed in." },
        { status: 401 }
      );
    }
    const role = session.user.role;
    if (role !== "owner" && role !== "manager") {
      return NextResponse.json(
        { success: false, error: "You don't have permission to assign batteries." },
        { status: 403 }
      );
    }

    const { rows: batteries } = await sql`
      SELECT
        b.id              AS id,
        b.barcode         AS barcode,
        b.serial_number   AS serial_number,
        bm.code           AS group_size,
        bt.name           AS battery_type
      FROM batteries b
      LEFT JOIN battery_models bm ON bm.id = b.battery_model_id
      LEFT JOIN battery_types  bt ON bt.id = b.battery_type_id
      WHERE b.status = 'in_warehouse'
        AND b.truck_id IS NULL
      ORDER BY bm.code, b.barcode;
    `;

    const { rows: trucks } = await sql`
      SELECT
        t.id            AS id,
        t.truck_number  AS truck_number,
        t.year_model    AS year_model,
        d.name          AS driver_name
      FROM trucks t
      LEFT JOIN drivers d ON d.id = t.current_driver_id
      ORDER BY t.truck_number;
    `;

    return NextResponse.json({ success: true, batteries, trucks });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST — assign one battery to one truck. Auto-approved (admin is the verifier).
// Now also captures the truck's current driver onto the battery and the movement
// row, so a battery on a truck is always traceable to a person.
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Not signed in." },
        { status: 401 }
      );
    }
    const role = session.user.role;
    if (role !== "owner" && role !== "manager") {
      return NextResponse.json(
        { success: false, error: "You don't have permission to assign batteries." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const batteryId: string | undefined = body?.batteryId;
    const truckId: string | undefined = body?.truckId;
    if (!batteryId || !truckId) {
      return NextResponse.json(
        { success: false, error: "Pick both a battery and a truck." },
        { status: 400 }
      );
    }

    const assigner = session.user.name || session.user.email || session.user.id;

    // Pull the truck AND its current driver, so we can stamp the driver too.
    const { rows: truckRows } = await sql`
      SELECT id, truck_number, current_driver_id
      FROM trucks WHERE id = ${truckId} LIMIT 1;
    `;
    if (truckRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Truck not found." },
        { status: 404 }
      );
    }
    const truck = truckRows[0];
    const driverId: string | null = truck.current_driver_id ?? null;

    const { rows: batteryRows } = await sql`
      SELECT id, barcode, status, truck_id FROM batteries WHERE id = ${batteryId} LIMIT 1;
    `;
    if (batteryRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Battery not found." },
        { status: 404 }
      );
    }
    const battery = batteryRows[0];
    if (battery.status !== "in_warehouse" || battery.truck_id !== null) {
      return NextResponse.json(
        { success: false, error: `Battery is not available to assign (status: ${battery.status}).` },
        { status: 409 }
      );
    }

    // Set status + truck + driver on the battery in one update.
    await sql`
      UPDATE batteries
      SET status = 'on_truck',
          truck_id = ${truck.id},
          current_truck_id = ${truck.id},
          current_driver_id = ${driverId}
      WHERE id = ${battery.id};
    `;

    const movementId = crypto.randomUUID();
    await sql`
      INSERT INTO battery_movements
        (id, battery_id, from_status, to_status, to_truck_id, driver_id,
         approval_status, approved_at, recorded_by_id, notes)
      VALUES
        (${movementId}, ${battery.id}, 'in_warehouse', 'on_truck',
         ${truck.id}, ${driverId},
         'approved', now(), ${session.user.id},
         ${`Assigned to truck #${truck.truck_number} by admin ${assigner}`});
    `;

    return NextResponse.json({
      success: true,
      message: `Battery ${battery.barcode} assigned to truck #${truck.truck_number}.`,
      batteryId: battery.id,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
