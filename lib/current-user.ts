// lib/current-user.ts
// Shared identity resolver for API routes.
//
// Returns WHO the request is, for BOTH auth paths:
//   - GitHub / NextAuth session (owner via OAuth)
//   - Manager session cookie (email+password, format: userId.expiry.signature)
//
// Routes should call getCurrentUser() and scope their queries by the returned
// orgId / companyIds. isSignedIn() is kept as a thin wrapper so existing routes
// that only need a yes/no gate keep working unchanged.

import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";
import { scryptSync, timingSafeEqual } from "crypto";

export type SessionType = "github" | "manager" | null;

export type CurrentUser = {
  userId: string;
  sessionType: SessionType;
  role: string | null;        // e.g. 'owner' | 'manager'
  orgId: string | null;       // tenant boundary (added in step 2)
  companyIds: string[];       // companies this user may see
};

// Recompute the signature the manager login route used, and compare.
// Returns the userId on success, or null on any failure.
function readManagerCookie(value: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiryStr, sig] = parts;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() >= expiry) return null;

  const secret = process.env.MIGRATE_SECRET || "";
  const payload = `${userId}.${expiry}`;
  const expected = scryptSync(payload, secret, 32).toString("hex");

  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  return userId;
}

// Resolve the raw identity (userId + sessionType) from either auth path.
async function resolveIdentity(): Promise<{ userId: string; sessionType: SessionType } | null> {
  // GitHub / NextAuth session first.
  try {
    const session = await auth();
    if (session?.user?.id) {
      return { userId: session.user.id, sessionType: "github" };
    }
  } catch {
    // ignore and fall through to manager check
  }

  // Manager session cookie.
  try {
    const cookieStore = await cookies();
    const mc = cookieStore.get("manager_session");
    if (mc?.value) {
      const userId = readManagerCookie(mc.value);
      if (userId) return { userId, sessionType: "manager" };
    }
  } catch {
    // ignore
  }

  return null;
}

// Look up role + org + companies for a userId.
// Written defensively: if the org/company-mapping schema isn't in place yet
// (step 2), this returns whatever it can and never throws, so the app keeps
// running. Once step 2 lands, this starts returning real scoping automatically.
async function loadScope(userId: string): Promise<{
  role: string | null;
  orgId: string | null;
  companyIds: string[];
}> {
  let role: string | null = null;
  let orgId: string | null = null;
  let companyIds: string[] = [];

  // Role from users table (this column exists today).
  try {
    const { rows } = await sql`
      SELECT role FROM users WHERE id = ${userId} LIMIT 1;
    `;
    if (rows.length > 0) role = (rows[0].role as string) ?? null;
  } catch {
    // ignore
  }

  // Org id — only exists after step 2. Defensive: ignore if column/table absent.
  try {
    const { rows } = await sql`
      SELECT org_id FROM users WHERE id = ${userId} LIMIT 1;
    `;
    if (rows.length > 0) orgId = (rows[0].org_id as string) ?? null;
  } catch {
    // org_id column not present yet — fine.
  }

  // Companies this user may see. Today this is the user_companies mapping;
  // after step 2 we can additionally constrain by org. Defensive either way.
  try {
    const { rows } = await sql`
      SELECT company_id FROM user_companies WHERE user_id = ${userId};
    `;
    companyIds = rows.map((r) => r.company_id as string).filter(Boolean);
  } catch {
    // user_companies not present for this user — leave empty.
  }

  return { role, orgId, companyIds };
}

// Full identity for the current request, or null if not signed in.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const id = await resolveIdentity();
  if (!id) return null;

  const scope = await loadScope(id.userId);
  return {
    userId: id.userId,
    sessionType: id.sessionType,
    role: scope.role,
    orgId: scope.orgId,
    companyIds: scope.companyIds,
  };
}

// Backward-compatible gate. Existing routes that only need a yes/no keep working.
export async function isSignedIn(): Promise<boolean> {
  const u = await getCurrentUser();
  return u !== null;
}
