// Shared helpers for org user management (/admin/users) and self password change.
import { sql } from "@vercel/postgres";
import { randomInt } from "crypto";

// Roles an owner/admin may assign. "owner" can only be granted by an owner.
export const ASSIGNABLE_ROLES = ["admin", "manager", "driver"] as const;
export const MANAGER_ROLES = ["owner", "admin"];

// Additive schema only: an 'admin' role value and a first-login flag.
let ready: Promise<void> | null = null;
export function ensureUserAdminSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      try {
        await sql`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';`;
      } catch {
        // role column may be plain TEXT - nothing to do.
      }
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;`;
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

// 12 chars, no look-alike characters, easy to read out loud.
export function tempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[randomInt(chars.length)];
  return out;
}

// Login id: an email address or a plain username (letters, digits, . _ -).
export function normalizeLogin(v: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return { ok: false, error: "Enter an email or username." };
  if (s.length > 320) return { ok: false, error: "That email or username is too long." };
  if (s.includes("@")) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return { ok: false, error: "That email address doesn't look right." };
  } else if (!/^[a-z0-9._-]{3,40}$/.test(s)) {
    return { ok: false, error: "Usernames are 3-40 letters, numbers, dots, dashes or underscores." };
  }
  return { ok: true, value: s };
}

// Logins are global (one sign-in page), so uniqueness is checked across all orgs.
export async function loginTaken(login: string, exceptUserId?: string): Promise<boolean> {
  const { rows } = await sql`
    SELECT 1 FROM users WHERE lower(email) = ${login} AND id <> ${exceptUserId ?? ""} LIMIT 1;`;
  return rows.length > 0;
}

// Active owners+admins left in the org if `excludeId` lost that status.
export async function otherActiveAdmins(orgId: string, excludeId: string): Promise<number> {
  const { rows } = await sql`
    SELECT COUNT(*)::int AS n FROM users
    WHERE org_id = ${orgId} AND id <> ${excludeId}
      AND status = 'active' AND role::text IN ('owner', 'admin');`;
  return Number(rows[0]?.n ?? 0);
}
