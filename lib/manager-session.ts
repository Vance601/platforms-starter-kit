// Issue the manager_session cookie (same format /api/auth-manager uses and
// lib/current-user.ts verifies: userId.expiry.sig).
import { scryptSync } from "crypto";
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
