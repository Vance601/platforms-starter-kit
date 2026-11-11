import { logAudit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto from "crypto";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Move a battery that is already on a truck: to another truck, or back to a
// warehouse/location. Used by staff (/admin/assign-trucks) and drivers
// (/driver/move). Drivers may only move stock off the truck they currently
// have claimed, and only to a truck or location in the same company.

function verifyDriverSession(token: string | undefined): string | null {
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

type Actor =
  | { kind: "driver"; driverId: string; driverName: string; companyId: string; claimedTruckId: string }
  | { kind: "staff"; userId: string; orgId: string; actorName: string };

async function resolveActor(req: NextRequest): Promise<
  { ok: true; actor: Actor } | { ok: false; res: NextResponse }
> {
  const driverId = verifyDriverSession(req.cookies.get("driver_session")?.value);
  if (driverId) {
    const { rows: driverRows } = await sql`
      SELECT id, name, company_id FROM drivers WHERE id = ${driverId} AND active = TRUE LIMIT 1;`;
    if (!driverRows.length) {
      return { ok: false, res: NextResponse.json({ success: false, error: "Driver not found." }, { status: 404 }) };
    }
    const d = driverRows[0];
    const { rows: truckRows } = await sql`
      SELECT id FROM trucks WHERE current_driver_id = ${driverId} LIMIT 1;`;
    if (!truckRows.length) {
      return {
        ok: false,
        res: NextResponse.json(
          { success: false, error: "You haven't claimed a truck yet. Claim a truck first, then move batteries." },
          { status: 409 },
        ),
      };
    }
    return {
      ok: true,
      actor: {
        kind: "driver",
        driverId: d.id,
        driverName: d.name,
        companyId: d.company_id,
        claimedTruckId: truckRows[0].id,
      },
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, res: NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 }) };
  }
  if (user.role !== "owner" && user.role !== "manager") {
    return { ok: false, res: NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 }) };
  }
  if (!user.orgId) {
    return { ok: false, res: NextResponse.json({ success: false, error: "No organization context." }, { status: 403 }) };
  }
  let actorName = user.userId;
  try {
    const { rows } = await sql`SELECT name, email FROM users WHERE id = ${user.userId} LIMIT 1;`;
    if (rows[0]) actorName = (rows[0].name as string) || (rows[0].email as string) || user.userId;
  } catch {
    // keep userId
  }
  return { ok: true, actor: { kind: "staff", userId: user.userId, orgId: user.orgId, actorName } };
}

export async function GET(req: NextRequest) {
  try {
    const r = await resolveActor(req);
    if (!r.ok) return r.res;
    const { actor } = r;

    if (actor.kind === "driver") {
      const { rows: batteries } = await sql`
        SELECT b.id, b.barcode, b.serial_number, b.status, b.location_id,
               b.truck_id, t.truck_number, l.name AS location_name,
               COALESCE(mdl.code, '') AS model_code
        FROM batteries b
        JOIN trucks t ON t.id = b.truck_id
        LEFT JOIN locations l ON l.id = b.location_id
        LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
        WHERE b.status = 'on_truck'
          AND b.truck_id = ${actor.claimedTruckId}
          AND b.company_id = ${actor.companyId}
        ORDER BY b.barcode;`;
      const { rows: trucks } = await sql`
        SELECT t.id, t.truck_number, t.year_model, t.location_id, d.name AS driver_name
        FROM trucks t
        LEFT JOIN drivers d ON d.id = t.current_driver_id
        WHERE t.company_id = ${actor.companyId} AND t.active = TRUE
        ORDER BY t.truck_number;`;
      const { rows: locations } = await sql`
        SELECT l.id, l.name, l.slug
        FROM locations l
        WHERE l.company_id = ${actor.companyId} AND l.active = TRUE
        ORDER BY l.name;`;
      const { rows: claimed } = await sql`
        SELECT id, truck_number FROM trucks WHERE id = ${actor.claimedTruckId} LIMIT 1;`;
      return NextResponse.json({
        success: true,
        role: "driver",
        claimedTruck: claimed[0] || null,
        batteries,
        trucks,
        locations,
      });
    }

    const { rows: batteries } = await sql`
      SELECT b.id, b.barcode, b.serial_number, b.status, b.location_id, b.company_id,
             b.truck_id, t.truck_number, l.name AS location_name,
             COALESCE(mdl.code, '') AS model_code, COALESCE(bt.code, typ.code, '') AS type_code
      FROM batteries b
      JOIN companies c ON c.id = b.company_id
      LEFT JOIN trucks t ON t.id = b.truck_id
      LEFT JOIN locations l ON l.id = b.location_id
      LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
      LEFT JOIN battery_types typ ON typ.id = mdl.battery_type_id
      LEFT JOIN battery_types bt ON bt.id = b.battery_type_id
      WHERE b.status = 'on_truck'
        AND b.truck_id IS NOT NULL
        AND c.org_id = ${actor.orgId}
      ORDER BY t.truck_number, b.barcode;`;
    const { rows: trucks } = await sql`
      SELECT t.id, t.truck_number, t.year_model, t.location_id, t.company_id, d.name AS driver_name
      FROM trucks t
      JOIN companies c ON c.id = t.company_id
      LEFT JOIN drivers d ON d.id = t.current_driver_id
      WHERE c.org_id = ${actor.orgId} AND t.active = TRUE
      ORDER BY t.truck_number;`;
    const { rows: locations } = await sql`
      SELECT l.id, l.name, l.slug, l.company_id, c.name AS company_name
      FROM locations l
      JOIN companies c ON c.id = l.company_id
      WHERE c.org_id = ${actor.orgId} AND l.active = TRUE
      ORDER BY c.name, l.name;`;
    return NextResponse.json({ success: true, role: "staff", batteries, trucks, locations });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const r = await resolveActor(req);
    if (!r.ok) return r.res;
    const { actor } = r;

    const body = await req.json().catch(() => ({}));
    const batteryId = String(body.batteryId || "").trim();
    const toTruckId = String(body.toTruckId || "").trim();
    const toLocationId = String(body.toLocationId || "").trim();
    if (!batteryId) {
      return NextResponse.json({ success: false, error: "Pick a battery." }, { status: 400 });
    }
    if ((toTruckId && toLocationId) || (!toTruckId && !toLocationId)) {
      return NextResponse.json(
        { success: false, error: "Pick either another truck or a warehouse location, not both." },
        { status: 400 },
      );
    }

    const { rows: batteryRows } = await sql`
      SELECT b.id, b.barcode, b.status, b.company_id, b.location_id, b.truck_id
      FROM batteries b
      WHERE b.id = ${batteryId}
      LIMIT 1;`;
    if (!batteryRows.length) {
      return NextResponse.json({ success: false, error: "Battery not found." }, { status: 404 });
    }
    const battery = batteryRows[0];

    if (actor.kind === "driver") {
      if (battery.company_id !== actor.companyId) {
        return NextResponse.json({ success: false, error: "That battery belongs to a different company." }, { status: 403 });
      }
      if (battery.status !== "on_truck" || battery.truck_id !== actor.claimedTruckId) {
        return NextResponse.json(
          { success: false, error: "That battery is not on the truck you have claimed." },
          { status: 409 },
        );
      }
    } else {
      const { rows: ok } = await sql`
        SELECT 1 FROM companies WHERE id = ${battery.company_id} AND org_id = ${actor.orgId} LIMIT 1;`;
      if (!ok.length) {
        return NextResponse.json({ success: false, error: "Battery not found." }, { status: 404 });
      }
      if (battery.status !== "on_truck" || !battery.truck_id) {
        return NextResponse.json(
          { success: false, error: `Battery is not on a truck (status: ${battery.status}).` },
          { status: 409 },
        );
      }
    }

    const fromTruckId = battery.truck_id as string;
    if (toTruckId && toTruckId === fromTruckId) {
      return NextResponse.json({ success: false, error: "Pick a different truck." }, { status: 400 });
    }

    let message = "";
    let destKind: "truck" | "location" = toTruckId ? "truck" : "location";
    let destTruckNumber: string | null = null;
    let destLocationName: string | null = null;

    if (toTruckId) {
      const { rows: destRows } = await sql`
        SELECT t.id, t.truck_number, t.company_id, t.location_id, t.current_driver_id, t.active
        FROM trucks t WHERE t.id = ${toTruckId} LIMIT 1;`;
      const dest = destRows[0];
      if (!dest || dest.active === false) {
        return NextResponse.json({ success: false, error: "Destination truck not found or inactive." }, { status: 404 });
      }
      if (dest.company_id !== battery.company_id) {
        return NextResponse.json({ success: false, error: "Pick a truck in the same company." }, { status: 400 });
      }
      destTruckNumber = dest.truck_number;
      const { rowCount } = await sql`
        UPDATE batteries
        SET status = 'on_truck',
            truck_id = ${dest.id},
            current_truck_id = ${dest.id},
            location_id = ${dest.location_id},
            current_driver_id = NULL
        WHERE id = ${battery.id}
          AND status = 'on_truck'
          AND truck_id = ${fromTruckId};`;
      if (!rowCount) {
        return NextResponse.json({ success: false, error: "That battery was just moved by someone else." }, { status: 409 });
      }

      const note =
        actor.kind === "driver"
          ? `Transferred from truck to truck #${dest.truck_number} by ${actor.driverName}`
          : `Transferred from truck to truck #${dest.truck_number} by admin ${actor.actorName}`;
      const movementId = crypto.randomUUID();
      if (actor.kind === "driver") {
        await sql`
          INSERT INTO battery_movements
            (id, battery_id, from_status, to_status, from_truck_id, to_truck_id,
             from_location_id, to_location_id, driver_id, approval_status, approved_at, notes)
          VALUES
            (${movementId}, ${battery.id}, 'on_truck', 'on_truck', ${fromTruckId}, ${dest.id},
             ${battery.location_id}, ${dest.location_id}, ${actor.driverId}, 'approved', now(), ${note});`;
      } else {
        await sql`
          INSERT INTO battery_movements
            (id, battery_id, from_status, to_status, from_truck_id, to_truck_id,
             from_location_id, to_location_id, recorded_by_id, approval_status, approved_at, notes)
          VALUES
            (${movementId}, ${battery.id}, 'on_truck', 'on_truck', ${fromTruckId}, ${dest.id},
             ${battery.location_id}, ${dest.location_id}, ${actor.userId}, 'approved', now(), ${note});`;
      }
      message = `Battery ${battery.barcode} moved to truck #${dest.truck_number}.`;
      await logAudit({
        action: "battery.transfer",
        actorType: actor.kind === "driver" ? "driver" : "user",
        actorId: actor.kind === "driver" ? actor.driverId : actor.userId,
        actorName: actor.kind === "driver" ? actor.driverName : actor.actorName,
        companyId: battery.company_id,
        entityType: "battery",
        entityId: battery.id,
        details: { barcode: battery.barcode, fromTruckId, toTruckId, movementId },
        req,
      }).catch(() => {});
    } else {
      const { rows: locRows } = await sql`
        SELECT l.id, l.name, l.company_id, l.active
        FROM locations l WHERE l.id = ${toLocationId} LIMIT 1;`;
      const loc = locRows[0];
      if (!loc || loc.active === false) {
        return NextResponse.json({ success: false, error: "Destination location not found or inactive." }, { status: 404 });
      }
      if (loc.company_id !== battery.company_id) {
        return NextResponse.json({ success: false, error: "Pick a location in the same company." }, { status: 400 });
      }
      destLocationName = loc.name;

      const { rowCount } = await sql`
        UPDATE batteries
        SET status = 'in_warehouse',
            truck_id = NULL,
            current_truck_id = NULL,
            current_driver_id = NULL,
            location_id = ${loc.id}
        WHERE id = ${battery.id}
          AND status = 'on_truck'
          AND truck_id = ${fromTruckId};`;
      if (!rowCount) {
        return NextResponse.json({ success: false, error: "That battery was just moved by someone else." }, { status: 409 });
      }

      const note =
        actor.kind === "driver"
          ? `Returned to warehouse (${loc.name}) by ${actor.driverName}`
          : `Returned to warehouse (${loc.name}) by admin ${actor.actorName}`;
      const movementId = crypto.randomUUID();
      if (actor.kind === "driver") {
        await sql`
          INSERT INTO battery_movements
            (id, battery_id, from_status, to_status, from_truck_id,
             from_location_id, to_location_id, driver_id, approval_status, approved_at, notes)
          VALUES
            (${movementId}, ${battery.id}, 'on_truck', 'in_warehouse', ${fromTruckId},
             ${battery.location_id}, ${loc.id}, ${actor.driverId}, 'approved', now(), ${note});`;
      } else {
        await sql`
          INSERT INTO battery_movements
            (id, battery_id, from_status, to_status, from_truck_id,
             from_location_id, to_location_id, recorded_by_id, approval_status, approved_at, notes)
          VALUES
            (${movementId}, ${battery.id}, 'on_truck', 'in_warehouse', ${fromTruckId},
             ${battery.location_id}, ${loc.id}, ${actor.userId}, 'approved', now(), ${note});`;
      }
      message = `Battery ${battery.barcode} returned to ${loc.name}.`;
      await logAudit({
        action: "battery.transfer",
        actorType: actor.kind === "driver" ? "driver" : "user",
        actorId: actor.kind === "driver" ? actor.driverId : actor.userId,
        actorName: actor.kind === "driver" ? actor.driverName : actor.actorName,
        companyId: battery.company_id,
        entityType: "battery",
        entityId: battery.id,
        details: { barcode: battery.barcode, fromTruckId, toLocationId, movementId },
        req,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message,
      destKind,
      destTruckNumber,
      destLocationName,
      battery: { id: battery.id, barcode: battery.barcode },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
