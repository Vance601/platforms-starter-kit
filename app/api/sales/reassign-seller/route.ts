import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { requireOrg } from "@/lib/require-org";
import { logAudit } from "@/lib/audit";
import { ensureLoggedByDriverColumn } from "@/lib/driver-roles";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Manager-only: change the selling driver on one past sold movement.
// Does not bulk-rewrite history. logged_by_driver_id is left as-is.
export async function POST(req: NextRequest) {
  const g = await requireOrg({ roles: ["owner", "manager"] });
  if (!g.ok) return g.response;
  const { user, orgId } = g;

  try {
    await ensureLoggedByDriverColumn();
    const body = await req.json().catch(() => ({}));
    const batteryId = typeof body.batteryId === "string" ? body.batteryId.trim() : "";
    const movementIdRaw = typeof body.movementId === "string" ? body.movementId.trim() : "";
    const newDriverId = typeof body.newDriverId === "string" ? body.newDriverId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";

    if (!batteryId && !movementIdRaw) {
      return NextResponse.json({ success: false, error: "Pick a sale (battery or movement)." }, { status: 400 });
    }
    if (!newDriverId) {
      return NextResponse.json({ success: false, error: "Pick the driver who should get credit." }, { status: 400 });
    }

    const { rows: driverRows } = await sql`
      SELECT d.id, d.name, d.active
      FROM drivers d
      JOIN companies c ON c.id = d.company_id
      WHERE d.id = ${newDriverId} AND c.org_id = ${orgId}
      LIMIT 1;
    `;
    if (!driverRows[0]) {
      return NextResponse.json({ success: false, error: "Driver not found in your organization." }, { status: 404 });
    }
    if (driverRows[0].active === false) {
      return NextResponse.json({ success: false, error: "That driver is inactive." }, { status: 400 });
    }
    const newDriver = driverRows[0];

    const { rows: moveRows } = movementIdRaw
      ? await sql`
          SELECT m.id, m.battery_id, m.driver_id, m.notes, b.barcode
          FROM battery_movements m
          JOIN batteries b ON b.id = m.battery_id
          JOIN companies c ON c.id = b.company_id
          WHERE m.id = ${movementIdRaw}
            AND m.to_status = 'sold'
            AND c.org_id = ${orgId}
          LIMIT 1;
        `
      : await sql`
          SELECT m.id, m.battery_id, m.driver_id, m.notes, b.barcode
          FROM battery_movements m
          JOIN batteries b ON b.id = m.battery_id
          JOIN companies c ON c.id = b.company_id
          WHERE b.id = ${batteryId}
            AND m.to_status = 'sold'
            AND c.org_id = ${orgId}
          ORDER BY m.occurred_at DESC
          LIMIT 1;
        `;
    if (!moveRows[0]) {
      return NextResponse.json({ success: false, error: "Sale not found." }, { status: 404 });
    }
    const movement = moveRows[0];
    if (movement.driver_id === newDriver.id) {
      return NextResponse.json({ success: false, error: "That sale is already credited to this driver." }, { status: 400 });
    }

    const { rows: prevRows } = await sql`
      SELECT name FROM drivers WHERE id = ${movement.driver_id} LIMIT 1;
    `;
    const previousName = (prevRows[0]?.name as string) || "unknown";
    const auditLine =
      ` | Reassigned seller from ${previousName} to ${newDriver.name} by manager` +
      (note ? `: ${note}` : "");

    await sql`
      UPDATE battery_movements
      SET driver_id = ${newDriver.id},
          notes = COALESCE(notes, '') || ${auditLine}
      WHERE id = ${movement.id};
    `;

    try {
      await sql`
        UPDATE sale_records
        SET driver_id = ${newDriver.id}
        WHERE movement_id = ${movement.id};
      `;
    } catch {
      // sale_records may not exist
    }

    await logAudit({
      action: "sale.reassign_seller",
      actorType: user.sessionType === "manager" ? "manager" : "user",
      actorId: user.userId,
      orgId,
      entityType: "battery",
      entityId: String(movement.battery_id),
      details: {
        movementId: movement.id,
        barcode: movement.barcode,
        previousDriverId: movement.driver_id,
        previousDriverName: previousName,
        newDriverId: newDriver.id,
        newDriverName: newDriver.name,
        note: note || null,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      message: `Sale of ${movement.barcode} is now credited to ${newDriver.name}.`,
      movementId: movement.id,
      batteryId: movement.battery_id,
      newDriverId: newDriver.id,
      newDriverName: newDriver.name,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
