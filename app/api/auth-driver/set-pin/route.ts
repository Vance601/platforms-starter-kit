import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Hash a PIN as "salt:hash" — same scheme as migrate-drivers/route.ts.
function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// Verify the session cookie set by auth-driver login.
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

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("driver_session")?.value;
    const driverId = verifySession(token);
    if (!driverId) {
      return NextResponse.json(
        { success: false, error: "Not signed in" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const newPin: string | undefined = body.newPin;

    if (!newPin || !/^\d{4}$/.test(newPin)) {
      return NextResponse.json(
        { success: false, error: "PIN must be exactly 4 digits" },
        { status: 400 }
      );
    }
    if (newPin === "0000") {
      return NextResponse.json(
        { success: false, error: "Pick a PIN other than 0000" },
        { status: 400 }
      );
    }

    const pinHash = hashPin(newPin);

    const { rowCount } = await sql`
      UPDATE drivers
      SET pin_hash = ${pinHash}
      WHERE id = ${driverId} AND active = TRUE;
    `;

    if (rowCount === 0) {
      return NextResponse.json(
        { success: false, error: "Driver not found or inactive" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
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
