// lib/current-user.ts
// Shared "is the request authenticated?" check.
// Returns true if the user is signed in via GitHub (NextAuth) OR a valid manager session.
// Use this in API routes instead of calling auth() directly, so manager logins work everywhere.

import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { scryptSync, timingSafeEqual } from "crypto";

// Recompute the signature the manager login route used, and compare.
function verifyManagerCookie(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [userId, expiryStr, sig] = parts;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() >= expiry) return false;

  const secret = process.env.MIGRATE_SECRET || "";
  const payload = `${userId}.${expiry}`;
  const expected = scryptSync(payload, secret, 32).toString("hex");

  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// True if signed in via GitHub OR a valid manager session.
export async function isSignedIn(): Promise<boolean> {
  // GitHub / NextAuth session
  try {
    const session = await auth();
    if (session?.user?.id) return true;
  } catch {
    // ignore and fall through to manager check
  }

  // Manager session cookie
  try {
    const cookieStore = await cookies();
    const mc = cookieStore.get("manager_session");
    if (mc?.value && verifyManagerCookie(mc.value)) return true;
  } catch {
    // ignore
  }

  return false;
}
