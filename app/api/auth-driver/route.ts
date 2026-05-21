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
    if (!driver.active) {
      return NextResponse.json(
        { success: false, error: "This driver is inactive. See a manager." },
        { status: 403 }
      );
    }
    if (!driver.pin_hash || !verifyPin(pin, driver.pin_hash)) return INVALID;

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
