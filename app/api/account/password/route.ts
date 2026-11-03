// POST { currentPassword, newPassword } -> change your own password.
// The current password is required whenever one is set.
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { scryptSync, timingSafeEqual } from "crypto";
import { getCurrentUser } from "@/lib/current-user";
import { hashPassword } from "@/lib/password-reset";
import { ensureUserAdminSchema } from "@/lib/user-admin";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function verify(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(password, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET() {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
  await ensureUserAdminSchema();
  const { rows } = await sql`SELECT name, email, (password_hash IS NOT NULL) AS has_password, must_change_password FROM users WHERE id = ${u.userId} LIMIT 1;`;
  return NextResponse.json({ success: true, user: rows[0] ?? null });
}

export async function POST(req: NextRequest) {
  try {
    const u = await getCurrentUser();
    if (!u) return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
    await ensureUserAdminSchema();
    const body = await req.json().catch(() => ({}));
    const current = String(body.currentPassword ?? "");
    const next = String(body.newPassword ?? "");
    if (next.length < 8) return NextResponse.json({ success: false, error: "New password must be at least 8 characters." }, { status: 400 });
    const { rows } = await sql`SELECT name, password_hash FROM users WHERE id = ${u.userId} LIMIT 1;`;
    const me = rows[0];
    if (!me) return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });
    if (me.password_hash) {
      if (!current || !verify(current, me.password_hash)) {
        await logAudit({ action: "password.change_failed", actorType: "manager", actorId: u.userId, actorName: me.name, orgId: u.orgId, entityType: "user", entityId: u.userId, req });
        return NextResponse.json({ success: false, error: "Current password is incorrect." }, { status: 403 });
      }
      if (current === next) return NextResponse.json({ success: false, error: "Pick a new password that's different from the current one." }, { status: 400 });
    }
    await sql`UPDATE users SET password_hash = ${hashPassword(next)}, must_change_password = false WHERE id = ${u.userId};`;
    await logAudit({ action: "password.changed", actorType: "manager", actorId: u.userId, actorName: me.name, orgId: u.orgId, entityType: "user", entityId: u.userId, req });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
