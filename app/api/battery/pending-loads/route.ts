import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Owner gate: ?pw= must match MIGRATE_SECRET (same pattern as other owner pages).
function ownerOk(req: NextRequest): boolean {
  const pw = req.nextUrl.searchParams.get("pw") || "";
  const secret = process.env.MIGRATE_SECRET || "";
  return secret.length > 0 && pw === secret;
}

export async function GET(req: NextRequest) {
  try {
    if (!ownerOk(req)) {
      return NextResponse.json(
        { success: false, error: "Not authorized." },
        { status: 401 }
      );
    }

    // Every load awaiting approval.
    //   - movement is a load:        to_status = 'on_truck'
    //   - not yet signed off:        approval_status = 'pending'
    // Joins (all LEFT so a missing lookup never drops a row):
    //   batteries        -> barcode, serial, group size, type
    //   battery_models   -> code (group size, e.g. "27")
    //   battery_types    -> name (Alpha/Bravo/AMG/Tesla/Prius)
    //   trucks           -> truck_number (destination truck on the movement)
    //   drivers          -> name (who scanned it)
    // occurred_at drives the 8-hour countdown on the page.
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
      ORDER BY m.occurred_at ASC;
    `;

    return NextResponse.json({
      success: true,
      count: rows.length,
      loads: rows,
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
