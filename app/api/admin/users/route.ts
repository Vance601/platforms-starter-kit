// Owner/manager password reset for email+password accounts in their own org.
// GET  -> users in the caller's organization (never password_hash)
// POST { userId, newPassword? , generate?: true } -> sets a new password.
//   - newPassword: at least 8 characters
//   - generate: server makes a temporary password and returns it ONCE
// Rules: real session (getCurrentUser), owner/manager only, same org only,
// only an owner may reset an owner's password, and roles are never changed.
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { randomBytes, randomInt, scryptSync } from "crypto";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Same scrypt "salt:hash" scheme verified by /api/auth-manager.
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// 12 chars, no look-alike characters, easy to read out loud.
function tempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[randomInt(chars.length)];
  return out;
}

async function gate() {
  const user = await getCurrentUser();
  if (!user) {
    return { res: NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 }) };
  }
  if (user.role !== "owner" && user.role !== "manager") {
    return { res: NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 }) };
  }
  if (!user.orgId) {
    return { res: NextResponse.json({ success: false, error: "Your account has no organization." }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  try {
    const g = await gate();
    if (!g.user) return g.res;
    const { rows } = await sql`
      SELECT id, name, email, role, status,
             (password_hash IS NOT NULL) AS has_password
      FROM users
      WHERE org_id = ${g.user.orgId}
      ORDER BY role, lower(coalesce(name, email));
    `;
    return NextResponse.json({ success: true, me: g.user.userId, myRole: g.user.role, users: rows });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const g = await gate();
    if (!g.user) return g.res;
    const body = await req.json().catch(() => ({}));
    const userId: string | undefined = body.userId;
    if (!userId) {
      return NextResponse.json({ success: false, error: "No user selected." }, { status: 400 });
    }

    const generated = body.generate === true;
    const newPassword: string = generated ? tempPassword() : String(body.newPassword ?? "");
    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const { rows } = await sql`
      SELECT id, name, email, role FROM users
      WHERE id = ${userId} AND org_id = ${g.user.orgId}
      LIMIT 1;
    `;
    const target = rows[0];
    if (!target) {
      return NextResponse.json({ success: false, error: "User not found in your organization." }, { status: 404 });
    }
    if (target.role === "owner" && g.user.role !== "owner") {
      return NextResponse.json(
        { success: false, error: "Only an owner can reset an owner's password." },
        { status: 403 }
      );
    }

    // Password only - role is deliberately left untouched.
    await sql`
      UPDATE users SET password_hash = ${hashPassword(newPassword)}
      WHERE id = ${target.id} AND org_id = ${g.user.orgId};
    `;

    return NextResponse.json({
      success: true,
      user: { id: target.id, name: target.name, email: target.email },
      // Shown once on screen; never stored in plain text.
      tempPassword: generated ? newPassword : undefined,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
