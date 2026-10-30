import { logAudit } from "@/lib/audit";
// POST { token, newPassword } -> sets the password and burns the token.
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { ensureResetTable, hashPassword, hashToken } from "@/lib/password-reset";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? "").trim();
    const newPassword = String(body.newPassword ?? "");
    if (!token) {
      return NextResponse.json({ success: false, error: "This reset link is missing its code." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, error: "Password must be at least 8 characters." }, { status: 400 });
    }

    await ensureResetTable();

    // Claim the token atomically: only one request can ever use it.
    const { rows } = await sql`
      UPDATE password_reset_tokens SET used_at = NOW()
      WHERE token_hash = ${hashToken(token)}
        AND used_at IS NULL
        AND expires_at > NOW()
      RETURNING user_id;
    `;
    if (rows.length === 0 || !rows[0].user_id) {
      return NextResponse.json(
        { success: false, error: "This reset link is invalid, expired, or already used. Request a new one." },
        { status: 400 }
      );
    }

    const { rowCount } = await sql`
      UPDATE users SET password_hash = ${hashPassword(newPassword)}
      WHERE id = ${rows[0].user_id} AND status = 'active';
    `;
    if (!rowCount) {
      return NextResponse.json({ success: false, error: "This account is inactive. See the owner." }, { status: 403 });
    }
    await logAudit({ action: "password.reset", actorType: "user", actorId: rows[0].user_id, entityType: "user", entityId: rows[0].user_id, req });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[password-reset/confirm] failed", err);
    return NextResponse.json({ success: false, error: "Something went wrong. Try again." }, { status: 500 });
  }
}
