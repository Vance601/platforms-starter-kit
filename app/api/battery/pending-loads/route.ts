import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
        { success: false, error: "You don't have permission to view load approvals." },
        { status: 403 }
      );
    }

    const { rows } = await sql`
      SELECT
        m.id                AS movement_id,
        m.occurred_at       AS occurred_at,
        m.battery_id        AS battery_id,
        m.to_truck_id       AS truck_id,
        m.driver_id         AS driver_id,
        m.notes             AS notes,
        b.barcode           AS barcode,
        b.serial_number     AS serial_number,
        b.status            AS battery_status,
        bm.code             AS group_size,
        bt.name             AS battery_type,
        t.truck_number      AS truck_number,
        d.name              AS driver_name
      FROM battery_movements m
      LEFT JOIN batteries      b  ON b.id  = m.battery_id
      LEFT JOIN battery_models bm ON bm.id = b.battery_model_id
      LEFT JOIN battery_types  bt ON bt.id = b.battery_type_id
      LEFT JOIN trucks         t  ON t.id  = m.to_truck_id
      LEFT JOIN drivers        d  ON d.id  = m.driver_id
      WHERE m.to_status = 'on_truck'
        AND m.approval_status = 'pending'
        AND b.status = 'on_truck'
      ORDER BY m.occurred_at ASC;
    `;

    return NextResponse.json({ success: true, count: rows.length, loads: rows });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
