import { logAudit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { scryptSync, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Verify a plaintext PIN against the stored "salt:hash" string.
// Same scrypt scheme as hashPin() in migrate-drivers/route.ts.
function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const testBuf = scryptSync(pin, salt, 64);
  if (hashBuf.length !== testBuf.length) return false;
  return timingSafeEqual(hashBuf, testBuf);
}

// Sign a session token using the same secret your migrations use.
function signSession(driverId: string, expiry: number): string {
  const secret = process.env.MIGRATE_SECRET || "";
  const payload = `${driverId}.${expiry}`;
  const sig = scryptSync(payload, secret, 32).toString("hex");
  return `${payload}.${sig}`;
}

// PIN brute-force lockout. 4-digit PINs are only 10,000 combinations, so
// failed attempts are counted per driver and the driver is locked out for
// LOCK_MINUTES after MAX_FAILS misses in a row. Stored in its own table
// (created on first use, additive only - drivers table untouched).
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
let lockTableReady: Promise<unknown> | null = null;
function ensureLockTable() {
  if (!lockTableReady) {
    lockTableReady = sql`
      CREATE TABLE IF NOT EXISTS driver_login_attempts (
        driver_id    TEXT PRIMARY KEY,
        failed_count INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMPTZ,
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `.catch((e) => {
      lockTableReady = null;
      throw e;
    });
  }
  return lockTableReady;
}

const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours — covers a shift

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const driverId: string | undefined = body.driverId;
    const pin: string | undefined = body.pin;

    if (!driverId || !pin) {
      return NextResponse.json(
        { success: false, error: "driverId and pin are required" },
        { status: 400 }
      );
    }

    const { rows } = await sql`
      SELECT drivers.id,
             drivers.name,
             drivers.company_id,
             drivers.active,
             drivers.pin_hash,
             companies.slug AS company
      FROM drivers
      JOIN companies ON companies.id = drivers.company_id
      WHERE drivers.id = ${driverId}
      LIMIT 1;
    `;

    const driver = rows[0];

    const INVALID = NextResponse.json(
      { success: false, error: "Invalid driver ID or PIN" },
      { status: 401 }
    );

    if (!driver) return INVALID;

    await ensureLockTable();
    const { rows: lockRows } = await sql`
      SELECT locked_until FROM driver_login_attempts
      WHERE driver_id = ${String(driver.id)} AND locked_until > NOW()
      LIMIT 1;
    `;
    if (lockRows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many wrong PINs. Try again in ${LOCK_MINUTES} minutes or ask a manager to reset your PIN.`,
        },
        { status: 429 }
      );
    }
    if (!driver.active) {
      return NextResponse.json(
        { success: false, error: "This driver is inactive. See a manager." },
        { status: 403 }
      );
    }
    if (!driver.pin_hash || !verifyPin(pin, driver.pin_hash)) {
      // Count the miss; lock once it reaches MAX_FAILS (then the counter restarts).
      await sql`
        INSERT INTO driver_login_attempts (driver_id, failed_count, updated_at)
        VALUES (${String(driver.id)}, 1, NOW())
        ON CONFLICT (driver_id) DO UPDATE
        SET failed_count = CASE
              WHEN driver_login_attempts.failed_count + 1 >= ${MAX_FAILS} THEN 0
              ELSE driver_login_attempts.failed_count + 1 END,
            locked_until = CASE
              WHEN driver_login_attempts.failed_count + 1 >= ${MAX_FAILS}
              THEN NOW() + make_interval(mins => ${LOCK_MINUTES})
              ELSE driver_login_attempts.locked_until END,
            updated_at = NOW();
      `;
      await logAudit({ action: "login.driver_failed", actorType: "anonymous", actorId: driver.id, actorName: driver.name, companyId: driver.company_id, req });
      return INVALID;
    }
    await logAudit({ action: "login.driver", actorType: "driver", actorId: driver.id, actorName: driver.name, companyId: driver.company_id, req });

    await sql`DELETE FROM driver_login_attempts WHERE driver_id = ${String(driver.id)};`;

    const expiry = Date.now() + SESSION_MAX_AGE * 1000;
    const token = signSession(driver.id, expiry);

    // True when the PIN is still the seeded placeholder — force a reset.
    const mustChangePin = verifyPin("0000", driver.pin_hash);

    const res = NextResponse.json({
      success: true,
      driver: {
        id: driver.id,
        name: driver.name,
        company: driver.company,
        company_id: driver.company_id,
      },
      mustChangePin,
    });

    res.cookies.set("driver_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    return res;
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

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("driver_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
