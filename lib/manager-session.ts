// Issue the manager_session cookie (same format /api/auth-manager uses and
// lib/current-user.ts verifies: userId.expiry.sig).
import { scryptSync, timingSafeEqual } from "crypto";
import type { NextResponse } from "next/server";

const COOKIE_DOMAIN = process.env.NODE_ENV === "production" ? ".battery-city.com" : undefined;

export function signManagerSession(userId: string, expiry: number): string {
  const secret = process.env.MIGRATE_SECRET || "";
  const payload = `${userId}.${expiry}`;
  return `${payload}.${scryptSync(payload, secret, 32).toString("hex")}`;
}

export function setManagerSession(res: NextResponse, userId: string, maxAgeSec = 60 * 60 * 12) {
  const token = signManagerSession(userId, Date.now() + maxAgeSec * 1000);
  res.cookies.set("manager_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain: COOKIE_DOMAIN,
    maxAge: maxAgeSec,
  });
}

// Returns the userId of a valid, unexpired manager_session token, else null.
export function verifyManagerSession(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  if (!(Number(exp) > Date.now())) return null;
  const expected = signManagerSession(userId, Number(exp)).split(".")[2];
  const a = Buffer.from(sig, "hex"), b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b) ? userId : null;
}
