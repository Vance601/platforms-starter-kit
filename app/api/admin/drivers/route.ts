// app/api/admin/drivers/route.ts
// Owner/manager only, scoped to the caller's organization.
//
// Scoping is by orgId, NOT companyIds: managers have no rows in user_companies,
// so scoping on that would lock them out. Every read and write is constrained to
// companies belonging to the caller's org.

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser, type CurrentUser } from "@/lib/current-user";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// scrypt "salt:hash" - same scheme as migrate-drivers/set-pin.
function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// Owner/manager gate - verified on EVERY request via the session.
// Also requires an org, since every query below is scoped by it.
async function requireManager(): Promise<
  { ok: true; user: CurrentUser & { orgId: string } } | { ok: false; res: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      res: NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 }),
    };
  }
  if (user.role !== "owner" && user.role !== "manager") {
    return {
      ok: false,
      res: NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 }),
    };
  }
  if (!user.orgId) {
    return {
      ok: false,
      res: NextResponse.json(
        { success: false, error: "No organization context." },
        { status: 403 }
      ),
    };
  }
  return { ok: true, user: { ...user, orgId: user.orgId } };
}

// GET - list drivers in this org (active + inactive) + who is on shift now.
export async function GET() {
  const gate = await requireManager();
  if (!gate.ok) return gate.res;
  const { orgId } = gate.user;

  try {
    const { rows: drivers } = await sql`
      SELECT drivers.id,
             drivers.name,
             drivers.active,
             companies.slug AS company
      FROM drivers
      JOIN companies ON companies.id = drivers.company_id
      WHERE companies.org_id = ${orgId}
      ORDER BY drivers.active DESC, drivers.name;
    `;

    // Open shifts (ended_at IS NULL) - who is on which truck right now.
    const { rows: onShift } = await sql`
      SELECT truck_shifts.driver_id, trucks.truck_number
      FROM truck_shifts
      JOIN drivers   ON drivers.id = truck_shifts.driver_id
      JOIN companies ON companies.id = drivers.company_id
      JOIN trucks    ON trucks.id = truck_shifts.truck_id
      WHERE truck_shifts.ended_at IS NULL
        AND companies.org_id = ${orgId};
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

// POST - add a new driver (seeded PIN 0000).
export async function POST(req: NextRequest) {
  const gate = await requireManager();
  if (!gate.ok) return gate.res;
  const { orgId } = gate.user;

  try {
    const body = await req.json().catch(() => ({}));

    const name = (body.name as string | undefined)?.trim();
    const company = (body.company as string | undefined)?.trim();
    if (!name || !company) {
      return NextResponse.json(
        { success: false, error: "name and company are required" },
        { status: 400 }
      );
    }

    // Slugs are NOT unique across orgs - must filter by org_id.
    const { rows: companyRows } = await sql`
      SELECT id FROM companies
      WHERE slug = ${company} AND org_id = ${orgId}
      LIMIT 1;
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

// PATCH - edit name/company, toggle active, or reset PIN.
// body.action: "edit" | "toggleActive" | "resetPin"
export async function PATCH(req: NextRequest) {
  const gate = await requireManager();
  if (!gate.ok) return gate.res;
  const { orgId } = gate.user;

  const NOT_FOUND = NextResponse.json(
    { success: false, error: "Driver not found." },
    { status: 404 }
  );

  try {
    const body = await req.json().catch(() => ({}));

    const driverId = body.driverId as string | undefined;
    const action = body.action as string | undefined;
    if (!driverId || !action) {
      return NextResponse.json(
        { success: false, error: "driverId and action are required" },
        { status: 400 }
      );
    }

    // The driver must live in a company inside the caller's org.
    const { rows: ownRows } = await sql`
      SELECT drivers.id
      FROM drivers
      JOIN companies ON companies.id = drivers.company_id
      WHERE drivers.id = ${driverId} AND companies.org_id = ${orgId}
      LIMIT 1;
    `;
    if (ownRows.length === 0) return NOT_FOUND;

    if (action === "edit") {
      const name = (body.name as string | undefined)?.trim();
      const company = (body.company as string | undefined)?.trim();
      if (!name || !company) {
        return NextResponse.json(
          { success: false, error: "name and company are required" },
          { status: 400 }
        );
      }
      // Destination company must also be inside this org.
      const { rows: companyRows } = await sql`
        SELECT id FROM companies
        WHERE slug = ${company} AND org_id = ${orgId}
        LIMIT 1;
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
      if (rows.length === 0) return NOT_FOUND;
      const nowActive = rows[0]?.active;
      return NextResponse.json({
        success: true,
        message: nowActive ? "Driver reactivated" : "Driver deactivated",
        active: nowActive,
      });
    }

    if (action === "resetPin") {
      const pinHash = hashPin("0000");
      const { rows } = await sql`
        UPDATE drivers SET pin_hash = ${pinHash}
        WHERE id = ${driverId}
        RETURNING id;
      `;
      if (rows.length === 0) return NOT_FOUND;
      return NextResponse.json({
        success: true,
        message: "PIN reset to 0000 - driver sets a new one at next login",
      });
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: `Unknown error` },
      { status: 500 }
    );
  }
}
