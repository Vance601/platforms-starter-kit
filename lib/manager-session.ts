// Issue the manager_session cookie (same format /api/auth-manager uses and
// lib/current-user.ts verifies: userId.expiry.sig).
import { scryptSync, timingSafeEqual } from "crypto";
import type { NextResponse } from "next/server";

// Share the cookie across www/apex only when actually served from battery-city.com.
// On any other host (e.g. *.vercel.app) a Domain=.battery-city.com cookie is
// rejected by the browser, so fall back to a host-only cookie.
export function cookieDomainFor(host: string | null | undefined): string | undefined {
  const h = (host || "").split(":")[0].toLowerCase();
  return process.env.NODE_ENV === "production" && (h === "battery-city.com" || h.endsWith(".battery-city.com"))
    ? ".battery-city.com" : undefined;
}
export function requestHost(req: { headers: Headers }): string {
  return req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
}

export function signManagerSession(userId: string, expiry: number): string {
  const secret = process.env.MIGRATE_SECRET || "";
  const payload = `${userId}.${expiry}`;
  return `${payload}.${scryptSync(payload, secret, 32).toString("hex")}`;
}

export function setManagerSession(res: NextResponse, userId: string, maxAgeSec = 60 * 60 * 12, host?: string) {
  const token = signManagerSession(userId, Date.now() + maxAgeSec * 1000);
  res.cookies.set("manager_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain: cookieDomainFor(host),
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
