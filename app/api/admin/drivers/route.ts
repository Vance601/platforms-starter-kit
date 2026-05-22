import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// scrypt "salt:hash" — same scheme as migrate-drivers/set-pin.
function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// Owner password check — verified on EVERY request, server-side.
function checkAdmin(req: NextRequest, body?: Record<string, unknown>): boolean {
  const pw =
    req.nextUrl.searchParams.get("pw") ||
    (body?.pw as string | undefined) ||
    req.headers.get("x-admin-pw") ||
    "";
  const expected = process.env.MIGRATE_SECRET || "";
  return expected.length > 0 && pw === expected;
}

const DENY = NextResponse.json(
  { success: false, error: "Unauthorized" },
  { status: 401 }
);

// GET — list all drivers (active + inactive) + who is on shift now.
export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return DENY;
  try {
    const { rows: drivers } = await sql`
      SELECT drivers.id,
             drivers.name,
             drivers.active,
             companies.slug AS company
      FROM drivers
      JOIN companies ON companies.id = drivers.company_id
      ORDER BY drivers.active DESC, drivers.name;
    `;

    // Open shifts (ended_at IS NULL) — who is on which truck right now.
    const { rows: onShift } = await sql`
      SELECT truck_shifts.driver_id, trucks.truck_number
      FROM truck_shifts
      JOIN trucks ON trucks.id = truck_shifts.truck_id
      WHERE truck_shifts.ended_at IS NULL;
    `;
    const shiftMap: Record<string, string> = {};
    for (const s of onShift) shiftMap[s.driver_id] = s.truck_number;

    const result = drivers.map((d) => ({
      ...d,
      onShiftTruck: shiftMap[d.id] ?? null,
    }));

    return NextResponse.json({ success: true, drivers: result });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST — add a new driver (seeded PIN 0000).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!checkAdmin(req, body)) return DENY;

    const name = (body.name as string | undefined)?.trim();
    const company = (body.company as string | undefined)?.trim();
    if (!name || !company) {
      return NextResponse.json(
        { success: false, error: "name and company are required" },
        { status: 400 }
      );
    }

    const { rows: companyRows } = await sql`
      SELECT id FROM companies WHERE slug = ${company} LIMIT 1;
    `;
    const companyId = companyRows[0]?.id;
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: `Unknown company: ${company}` },
        { status: 400 }
      );
    }

    const pinHash = hashPin("0000");
    await sql`
      INSERT INTO drivers (name, company_id, pin_hash, active)
      VALUES (${name}, ${companyId}, ${pinHash}, TRUE);
    `;

    return NextResponse.json({ success: true, message: `Added ${name}` });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH — edit name/company, toggle active, or reset PIN.
// body.action: "edit" | "toggleActive" | "resetPin"
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!checkAdmin(req, body)) return DENY;

    const driverId = body.driverId as string | undefined;
    const action = body.action as string | undefined;
    if (!driverId || !action) {
      return NextResponse.json(
        { success: false, error: "driverId and action are required" },
        { status: 400 }
      );
    }

    if (action === "edit") {
      const name = (body.name as string | undefined)?.trim();
      const company = (body.company as string | undefined)?.trim();
      if (!name || !company) {
        return NextResponse.json(
          { success: false, error: "name and company are required" },
          { status: 400 }
        );
      }
      const { rows: companyRows } = await sql`
        SELECT id FROM companies WHERE slug = ${company} LIMIT 1;
      `;
      const companyId = companyRows[0]?.id;
      if (!companyId) {
        return NextResponse.json(
          { success: false, error: `Unknown company: ${company}` },
          { status: 400 }
        );
      }
      await sql`
        UPDATE drivers SET name = ${name}, company_id = ${companyId}
        WHERE id = ${driverId};
      `;
      return NextResponse.json({ success: true, message: "Driver updated" });
    }

    if (action === "toggleActive") {
      const { rows } = await sql`
        UPDATE drivers SET active = NOT active
        WHERE id = ${driverId}
        RETURNING active;
      `;
      const nowActive = rows[0]?.active;
      return NextResponse.json({
        success: true,
        message: nowActive ? "Driver reactivated" : "Driver deactivated",
        active: nowActive,
      });
    }

    if (action === "resetPin") {
      const pinHash = hashPin("0000");
      await sql`
        UPDATE drivers SET pin_hash = ${pinHash} WHERE id = ${driverId};
      `;
      return NextResponse.json({
        success: true,
        message: "PIN reset to 0000 — driver sets a new one at next login",
      });
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
