import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto from "crypto";
import { requireOrg } from "@/lib/require-org";
import { logAudit } from "@/lib/audit";
import { parseReportDate, todayYmd, zonedDateTime, zonedTimeHM } from "@/lib/org-day-range";
import { orgTimezone } from "@/lib/org-timezone";
import { toSortableIso } from "@/lib/sortable-iso";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CORE_STATUSES = ["owed", "returned", "customer_kept"] as const;
type CoreStatus = (typeof CORE_STATUSES)[number];

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function isCoreStatus(v: unknown): v is CoreStatus {
  return typeof v === "string" && (CORE_STATUSES as readonly string[]).includes(v);
}

async function loadSale(orgId: string, movementIdRaw: string, batteryIdRaw: string) {
  const { rows } = movementIdRaw
    ? await sql`
        SELECT
          m.id AS movement_id,
          m.battery_id,
          m.driver_id,
          m.from_truck_id,
          m.occurred_at,
          m.call_reference,
          m.notes,
          b.barcode,
          b.serial_number,
          b.status AS battery_status,
          b.company_id,
          b.location_id,
          b.battery_model_id,
          b.battery_type_id,
          b.is_warranty,
          b.sold_at,
          b.sold_on_call_number,
          b.current_truck_id,
          mdl.code AS model_code,
          d.name AS driver_name,
          t.truck_number,
          cr.id AS core_id,
          cr.status AS core_status,
          cr.refunded_at,
          cr.deposit_amount,
          s.quickbooks_invoice_id,
          COALESCE(s.towbook_call_number, b.sold_on_call_number, m.call_reference) AS call_number
        FROM battery_movements m
        JOIN batteries b ON b.id = m.battery_id
        JOIN companies c ON c.id = b.company_id
        LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
        LEFT JOIN drivers d ON d.id = m.driver_id
        LEFT JOIN trucks t ON t.id = m.from_truck_id
        LEFT JOIN LATERAL (
          SELECT c2.id, c2.status, c2.refunded_at, c2.deposit_amount
          FROM core_returns c2
          WHERE c2.battery_id = b.id
          ORDER BY c2.returned_at DESC NULLS LAST
          LIMIT 1
        ) cr ON true
        LEFT JOIN LATERAL (
          SELECT s2.quickbooks_invoice_id, s2.towbook_call_number
          FROM sales s2
          WHERE s2.battery_id = b.id
          ORDER BY s2.sold_at DESC NULLS LAST
          LIMIT 1
        ) s ON true
        WHERE m.id = ${movementIdRaw}
          AND m.to_status = 'sold'
          AND c.org_id = ${orgId}
        LIMIT 1;
      `
    : await sql`
        SELECT
          m.id AS movement_id,
          m.battery_id,
          m.driver_id,
          m.from_truck_id,
          m.occurred_at,
          m.call_reference,
          m.notes,
          b.barcode,
          b.serial_number,
          b.status AS battery_status,
          b.company_id,
          b.location_id,
          b.battery_model_id,
          b.battery_type_id,
          b.is_warranty,
          b.sold_at,
          b.sold_on_call_number,
          b.current_truck_id,
          mdl.code AS model_code,
          d.name AS driver_name,
          t.truck_number,
          cr.id AS core_id,
          cr.status AS core_status,
          cr.refunded_at,
          cr.deposit_amount,
          s.quickbooks_invoice_id,
          COALESCE(s.towbook_call_number, b.sold_on_call_number, m.call_reference) AS call_number
        FROM battery_movements m
        JOIN batteries b ON b.id = m.battery_id
        JOIN companies c ON c.id = b.company_id
        LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
        LEFT JOIN drivers d ON d.id = m.driver_id
        LEFT JOIN trucks t ON t.id = m.from_truck_id
        LEFT JOIN LATERAL (
          SELECT c2.id, c2.status, c2.refunded_at, c2.deposit_amount
          FROM core_returns c2
          WHERE c2.battery_id = b.id
          ORDER BY c2.returned_at DESC NULLS LAST
          LIMIT 1
        ) cr ON true
        LEFT JOIN LATERAL (
          SELECT s2.quickbooks_invoice_id, s2.towbook_call_number
          FROM sales s2
          WHERE s2.battery_id = b.id
          ORDER BY s2.sold_at DESC NULLS LAST
          LIMIT 1
        ) s ON true
        WHERE b.id = ${batteryIdRaw}
          AND m.to_status = 'sold'
          AND c.org_id = ${orgId}
        ORDER BY m.occurred_at DESC
        LIMIT 1;
      `;
  return rows[0] || null;
}

function inferredCoreStatus(row: { core_status?: unknown; battery_status?: unknown }): CoreStatus {
  const cr = str(row.core_status);
  if (isCoreStatus(cr)) return cr;
  return String(row.battery_status || "") === "returned_core" ? "returned" : "owed";
}

async function loadOptions(orgId: string) {
  const [{ rows: models }, { rows: trucks }, { rows: drivers }] = await Promise.all([
    sql`
      SELECT bm.id, bm.code, COALESCE(bm.display_name, bm.code) AS name
      FROM battery_models bm
      WHERE bm.active IS NOT FALSE
      ORDER BY bm.code;
    `,
    sql`
      SELECT t.id, t.truck_number
      FROM trucks t
      JOIN companies c ON c.id = t.company_id
      WHERE c.org_id = ${orgId} AND t.active IS NOT FALSE
      ORDER BY t.truck_number;
    `,
    sql`
      SELECT d.id, d.name
      FROM drivers d
      JOIN companies c ON c.id = d.company_id
      WHERE c.org_id = ${orgId} AND d.active IS NOT FALSE
      ORDER BY d.name;
    `,
  ]);
  return { models, trucks, drivers, coreStatuses: CORE_STATUSES };
}

export async function GET(req: NextRequest) {
  const g = await requireOrg({ roles: ["owner", "manager"] });
  if (!g.ok) return g.response;
  const { orgId } = g;

  const movementId = str(req.nextUrl.searchParams.get("movementId")) || "";
  const batteryId = str(req.nextUrl.searchParams.get("batteryId")) || "";
  if (!movementId && !batteryId) {
    const options = await loadOptions(orgId);
    return NextResponse.json({ success: true, options });
  }

  try {
    const timeZone = await orgTimezone(orgId);
    const row = await loadSale(orgId, movementId, batteryId);
    if (!row) {
      return NextResponse.json({ success: false, error: "Sale not found." }, { status: 404 });
    }
    const occurred = row.sold_at || row.occurred_at;
    const occurredDate = occurred ? new Date(occurred as string) : null;
    const options = await loadOptions(orgId);
    return NextResponse.json({
      success: true,
      timeZone,
      entry: {
        movementId: row.movement_id,
        batteryId: row.battery_id,
        barcode: row.barcode,
        serialNumber: row.serial_number,
        modelCode: row.model_code,
        truckId: row.from_truck_id,
        truckNumber: row.truck_number,
        driverId: row.driver_id,
        driverName: row.driver_name,
        callNumber: row.call_number,
        invoiceNumber: row.quickbooks_invoice_id,
        isWarranty: !!row.is_warranty,
        coreStatus: inferredCoreStatus(row),
        soldAt: occurredDate && !Number.isNaN(occurredDate.getTime()) ? occurredDate.toISOString() : null,
        soldDate: occurredDate && !Number.isNaN(occurredDate.getTime()) ? todayYmd(timeZone, occurredDate) : null,
        soldTime: occurredDate && !Number.isNaN(occurredDate.getTime()) ? zonedTimeHM(occurredDate, timeZone) : null,
      },
      options,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

async function applyCoreStatus(opts: {
  orgId: string;
  row: Record<string, unknown>;
  next: CoreStatus;
  actorName: string;
}): Promise<string | null> {
  const { row, next, actorName } = opts;
  const current = inferredCoreStatus(row);
  if (current === next) return null;
  if (row.refunded_at) {
    return "This core already has a refund or credit, so its status cannot be changed here.";
  }

  const batteryId = String(row.battery_id);
  const companyId = String(row.company_id);
  const locationId = (row.location_id as string) || null;
  let coreId = str(row.core_id);

  if (!coreId) {
    coreId = crypto.randomUUID();
    await sql`
      INSERT INTO core_returns (id, battery_id, company_id, location_id, status, notes)
      VALUES (
        ${coreId}, ${batteryId}, ${companyId}, ${locationId},
        ${current}, ${" | Created while editing a sale"}
      );
    `;
  }

  if (next === "returned") {
    await sql`
      UPDATE core_returns
      SET status = 'returned',
          returned_at = COALESCE(returned_at, NOW()),
          notes = COALESCE(notes, '') || ${` | Core marked returned by ${actorName} (sale edit)`}
      WHERE id = ${coreId};
    `;
    await sql`
      UPDATE batteries
      SET status = 'returned_core'
      WHERE id = ${batteryId} AND company_id = ${companyId} AND status = 'sold';
    `;
    const { rows: already } = await sql`
      SELECT id FROM battery_movements
      WHERE battery_id = ${batteryId} AND to_status = 'returned_core'
      ORDER BY occurred_at DESC LIMIT 1;
    `;
    if (!already[0] && String(row.battery_status) !== "returned_core") {
      await sql`
        INSERT INTO battery_movements
          (id, battery_id, from_status, to_status, from_truck_id, driver_id, call_reference, notes)
        VALUES (
          ${crypto.randomUUID()}, ${batteryId}, 'sold', 'returned_core',
          ${row.current_truck_id || row.from_truck_id}, ${row.driver_id},
          ${row.sold_on_call_number}, ${`Core marked returned by ${actorName} (sale edit)`}
        );
      `;
    }
    return null;
  }

  if (next === "customer_kept") {
    await sql`
      UPDATE core_returns
      SET status = 'customer_kept',
          returned_at = COALESCE(returned_at, NOW()),
          notes = COALESCE(notes, '') || ${` | Core marked customer kept by ${actorName} (sale edit)`}
      WHERE id = ${coreId};
    `;
    await sql`
      UPDATE batteries
      SET status = 'sold'
      WHERE id = ${batteryId} AND company_id = ${companyId} AND status = 'returned_core';
    `;
    return null;
  }

  // next === "owed"
  await sql`
    UPDATE core_returns
    SET status = 'owed',
        returned_at = NULL,
        notes = COALESCE(notes, '') || ${` | Core marked owed again by ${actorName} (sale edit)`}
    WHERE id = ${coreId};
  `;
  await sql`
    UPDATE batteries
    SET status = 'sold'
    WHERE id = ${batteryId} AND company_id = ${companyId} AND status = 'returned_core';
  `;
  return null;
}

export async function POST(req: NextRequest) {
  const g = await requireOrg({ roles: ["owner", "manager"] });
  if (!g.ok) return g.response;
  const { user, orgId } = g;

  try {
    const body = await req.json().catch(() => ({}));
    const movementId = str(body.movementId) || "";
    const batteryIdIn = str(body.batteryId) || "";
    if (!movementId && !batteryIdIn) {
      return NextResponse.json({ success: false, error: "Pick a sale to edit." }, { status: 400 });
    }

    const row = await loadSale(orgId, movementId, batteryIdIn);
    if (!row) {
      return NextResponse.json({ success: false, error: "Sale not found." }, { status: 404 });
    }

    const timeZone = await orgTimezone(orgId);
    const actorName = user.sessionType === "manager" ? "manager" : "owner";
    const note = str(body.note);

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const batteryId = String(row.battery_id);
    const movementIdReal = String(row.movement_id);

    // Model / size
    const nextModelCode = body.modelCode !== undefined ? str(body.modelCode) : str(row.model_code);
    if (nextModelCode && nextModelCode !== str(row.model_code)) {
      const { rows: models } = await sql`
        SELECT id, battery_type_id, code FROM battery_models
        WHERE code = ${nextModelCode} AND active IS NOT FALSE
        LIMIT 1;
      `;
      if (!models[0]) {
        return NextResponse.json({ success: false, error: "Unknown battery size/model." }, { status: 400 });
      }
      await sql`
        UPDATE batteries
        SET battery_model_id = ${models[0].id},
            battery_type_id = ${models[0].battery_type_id}
        WHERE id = ${batteryId};
      `;
      changes.model = { from: row.model_code, to: models[0].code };
    }

    // Truck (sale truck only — does not move on-hand stock)
    if (body.truckId !== undefined) {
      const nextTruckId = str(body.truckId);
      if (nextTruckId !== str(row.from_truck_id)) {
        if (nextTruckId) {
          const { rows: trucks } = await sql`
            SELECT t.id, t.truck_number
            FROM trucks t
            JOIN companies c ON c.id = t.company_id
            WHERE t.id = ${nextTruckId} AND c.org_id = ${orgId}
            LIMIT 1;
          `;
          if (!trucks[0]) {
            return NextResponse.json({ success: false, error: "Truck not found in your organization." }, { status: 404 });
          }
          await sql`UPDATE battery_movements SET from_truck_id = ${trucks[0].id} WHERE id = ${movementIdReal};`;
          changes.truck = { from: row.truck_number, to: trucks[0].truck_number };
        } else {
          await sql`UPDATE battery_movements SET from_truck_id = NULL WHERE id = ${movementIdReal};`;
          changes.truck = { from: row.truck_number, to: null };
        }
      }
    }

    // Driver
    if (body.driverId !== undefined) {
      const nextDriverId = str(body.driverId);
      if (!nextDriverId) {
        return NextResponse.json({ success: false, error: "Pick the driver who should get credit." }, { status: 400 });
      }
      if (nextDriverId !== str(row.driver_id)) {
        const { rows: drivers } = await sql`
          SELECT d.id, d.name, d.active
          FROM drivers d
          JOIN companies c ON c.id = d.company_id
          WHERE d.id = ${nextDriverId} AND c.org_id = ${orgId}
          LIMIT 1;
        `;
        if (!drivers[0]) {
          return NextResponse.json({ success: false, error: "Driver not found in your organization." }, { status: 404 });
        }
        if (drivers[0].active === false) {
          return NextResponse.json({ success: false, error: "That driver is inactive." }, { status: 400 });
        }
        await sql`UPDATE battery_movements SET driver_id = ${drivers[0].id} WHERE id = ${movementIdReal};`;
        try {
          await sql`UPDATE sale_records SET driver_id = ${drivers[0].id} WHERE movement_id = ${movementIdReal};`;
        } catch {}
        try {
          await sql`UPDATE sales SET driver_id = ${drivers[0].id} WHERE battery_id = ${batteryId};`;
        } catch {}
        changes.driver = { from: row.driver_name, to: drivers[0].name };
      }
    }

    // Call number
    if (body.callNumber !== undefined) {
      const nextCall = str(body.callNumber);
      if (nextCall !== str(row.call_number)) {
        await sql`UPDATE batteries SET sold_on_call_number = ${nextCall} WHERE id = ${batteryId};`;
        await sql`UPDATE battery_movements SET call_reference = ${nextCall} WHERE id = ${movementIdReal};`;
        try {
          await sql`UPDATE sale_records SET call_number = ${nextCall} WHERE movement_id = ${movementIdReal};`;
        } catch {}
        try {
          await sql`UPDATE sales SET towbook_call_number = ${nextCall} WHERE battery_id = ${batteryId};`;
        } catch {}
        changes.callNumber = { from: row.call_number, to: nextCall };
      }
    }

    // Invoice number
    if (body.invoiceNumber !== undefined) {
      const nextInvoice = str(body.invoiceNumber);
      if (nextInvoice !== str(row.quickbooks_invoice_id)) {
        try {
          await sql`UPDATE sales SET quickbooks_invoice_id = ${nextInvoice} WHERE battery_id = ${batteryId};`;
          changes.invoiceNumber = { from: row.quickbooks_invoice_id, to: nextInvoice };
        } catch {
          return NextResponse.json(
            { success: false, error: "Could not update the invoice number on this sale." },
            { status: 400 },
          );
        }
      }
    }

    // Warranty flag
    if (body.isWarranty !== undefined) {
      const nextWarr = !!body.isWarranty;
      if (nextWarr !== !!row.is_warranty) {
        await sql`UPDATE batteries SET is_warranty = ${nextWarr} WHERE id = ${batteryId};`;
        try {
          await sql`UPDATE sale_records SET is_warranty_install = ${nextWarr} WHERE movement_id = ${movementIdReal};`;
        } catch {}
        changes.warranty = { from: !!row.is_warranty, to: nextWarr };
      }
    }

    // Sale date (keeps Driver Sales and the daily report in sync)
    if (body.soldDate !== undefined || body.soldAt !== undefined) {
      let nextDate: Date | null = null;
      if (typeof body.soldAt === "string" && body.soldAt.trim()) {
        const d = new Date(body.soldAt);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ success: false, error: "Sale date is not valid." }, { status: 400 });
        }
        nextDate = d;
      } else {
        const ymd = parseReportDate(body.soldDate);
        if (!ymd) {
          return NextResponse.json({ success: false, error: "Sale date must be YYYY-MM-DD." }, { status: 400 });
        }
        try {
          nextDate = zonedDateTime(ymd, str(body.soldTime), timeZone);
        } catch {
          return NextResponse.json({ success: false, error: "Sale time must be HH:MM." }, { status: 400 });
        }
      }
      const prevIso = toSortableIso(row.sold_at || row.occurred_at);
      const nextIso = nextDate.toISOString();
      if (prevIso !== nextIso) {
        await sql`UPDATE batteries SET sold_at = ${nextIso}::timestamptz WHERE id = ${batteryId};`;
        await sql`UPDATE battery_movements SET occurred_at = ${nextIso}::timestamptz WHERE id = ${movementIdReal};`;
        try {
          await sql`UPDATE sales SET sold_at = ${nextIso}::timestamptz WHERE battery_id = ${batteryId};`;
        } catch {}
        changes.soldAt = { from: prevIso || null, to: nextIso };
      }
    }

    // Core status
    if (body.coreStatus !== undefined) {
      if (!isCoreStatus(body.coreStatus)) {
        return NextResponse.json({ success: false, error: "Core status must be owed, returned, or customer kept." }, { status: 400 });
      }
      const before = inferredCoreStatus(row);
      if (before !== body.coreStatus) {
        const err = await applyCoreStatus({ orgId, row, next: body.coreStatus, actorName });
        if (err) return NextResponse.json({ success: false, error: err }, { status: 400 });
        changes.coreStatus = { from: before, to: body.coreStatus };
      }
    }

    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ success: false, error: "No changes to save." }, { status: 400 });
    }

    const auditLine =
      ` | Edited sale (${Object.keys(changes).join(", ")}) by ${actorName}` + (note ? `: ${note}` : "");
    await sql`
      UPDATE battery_movements
      SET notes = COALESCE(notes, '') || ${auditLine}
      WHERE id = ${movementIdReal};
    `;

    await logAudit({
      action: "sale.edit_entry",
      actorType: user.sessionType === "manager" ? "manager" : "user",
      actorId: user.userId,
      orgId,
      entityType: "battery",
      entityId: batteryId,
      details: {
        movementId: movementIdReal,
        barcode: row.barcode,
        changes,
        note: note || null,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      message: `Updated sale of ${row.barcode}.`,
      movementId: movementIdReal,
      batteryId,
      changes,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
