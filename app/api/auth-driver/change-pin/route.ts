// POST { currentPin, newPin } — a signed-in driver changes their own PIN.
// Requires the current PIN; wrong current PINs count toward the same lockout
// as login (driver_login_attempts: 5 misses -> 15 min lock). Audited.
import { logAudit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto, { scryptSync, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

function verifySession(token: string | undefined): string | null {
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

function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(pin, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(pin, salt, 64).toString("hex")}`;
}

export async function POST(req: NextRequest) {
  try {
    const driverId = verifySession(req.cookies.get("driver_session")?.value);
    if (!driverId) return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const currentPin = String(body.currentPin ?? "");
    const newPin = String(body.newPin ?? "");
    if (!/^\d{4}$/.test(newPin)) return NextResponse.json({ success: false, error: "New PIN must be exactly 4 digits" }, { status: 400 });
    if (newPin === "0000") return NextResponse.json({ success: false, error: "Pick a PIN other than 0000" }, { status: 400 });
    if (newPin === currentPin) return NextResponse.json({ success: false, error: "New PIN must be different from your current PIN" }, { status: 400 });

    const { rows } = await sql`SELECT id, name, company_id, active, pin_hash FROM drivers WHERE id = ${driverId} LIMIT 1;`;
    const d = rows[0];
    if (!d || !d.active) return NextResponse.json({ success: false, error: "Driver not found or inactive" }, { status: 404 });

    await sql`CREATE TABLE IF NOT EXISTS driver_login_attempts (
      driver_id TEXT PRIMARY KEY, failed_count INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`;
    const { rows: lock } = await sql`SELECT 1 FROM driver_login_attempts WHERE driver_id = ${String(d.id)} AND locked_until > NOW() LIMIT 1;`;
    if (lock.length) {
      return NextResponse.json({ success: false, error: `Too many wrong PINs. Try again in ${LOCK_MINUTES} minutes or ask a manager to reset your PIN.` }, { status: 429 });
    }

    if (!verifyPin(currentPin, d.pin_hash)) {
      await sql`
        INSERT INTO driver_login_attempts (driver_id, failed_count, updated_at)
        VALUES (${String(d.id)}, 1, NOW())
        ON CONFLICT (driver_id) DO UPDATE
        SET failed_count = CASE WHEN driver_login_attempts.failed_count + 1 >= ${MAX_FAILS} THEN 0
                                ELSE driver_login_attempts.failed_count + 1 END,
            locked_until = CASE WHEN driver_login_attempts.failed_count + 1 >= ${MAX_FAILS}
                                THEN NOW() + make_interval(mins => ${LOCK_MINUTES})
                                ELSE driver_login_attempts.locked_until END,
            updated_at = NOW();`;
      await logAudit({ action: "driver.pin_change_failed", actorType: "driver", actorId: d.id, actorName: d.name, companyId: d.company_id, entityType: "driver", entityId: d.id, req });
      return NextResponse.json({ success: false, error: "Current PIN is wrong" }, { status: 401 });
    }

    await sql`UPDATE drivers SET pin_hash = ${hashPin(newPin)} WHERE id = ${d.id};`;
    await sql`DELETE FROM driver_login_attempts WHERE driver_id = ${String(d.id)};`;
    await logAudit({ action: "driver.pin_change", actorType: "driver", actorId: d.id, actorName: d.name, companyId: d.company_id, entityType: "driver", entityId: d.id, req });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
