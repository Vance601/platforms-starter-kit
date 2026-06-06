// app/api/auth-manager/route.ts
// Manager login (email + password). Mirrors the driver PIN auth pattern.

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { scryptSync, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const testBuf = scryptSync(password, salt, 64);
  if (hashBuf.length !== testBuf.length) return false;
  return timingSafeEqual(hashBuf, testBuf);
}

function signSession(userId: string, expiry: number): string {
  const secret = process.env.MIGRATE_SECRET || "";
  const payload = `${userId}.${expiry}`;
  const sig = scryptSync(payload, secret, 32).toString("hex");
  return `${payload}.${sig}`;
}

const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email: string | undefined = body.email;
    const password: string | undefined = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const emailNorm = email.trim().toLowerCase();

    const { rows } = await sql`
      SELECT id, name, email, role, status, password_hash
      FROM users
      WHERE lower(email) = ${emailNorm}
      LIMIT 1;
    `;
    const user = rows[0];

    const INVALID = NextResponse.json(
      { success: false, error: "Invalid email or password" },
      { status: 401 }
    );

    if (!user) return INVALID;
    if (user.status !== "active") {
      return NextResponse.json(
        { success: false, error: "This account is inactive. See the owner." },
        { status: 403 }
      );
    }
    if (!user.password_hash || !verifyPassword(password, user.password_hash)) {
      return INVALID;
    }

    const expiry = Date.now() + SESSION_MAX_AGE * 1000;
    const token = signSession(user.id, expiry);

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    res.cookies.set("manager_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    return res;
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("manager_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
