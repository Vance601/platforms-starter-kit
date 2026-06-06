// app/api/auth-manager/set-password/route.ts
// Owner-gated: set or reset a manager's password by email.
// POST { pw, email, newPassword }  -> hashes newPassword, stores it, sets role='manager'
//   pw          = MIGRATE_SECRET (owner gate)
//   email       = the manager's email (must already exist in users)
//   newPassword = the password to set (min 8 chars)

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { randomBytes, scryptSync } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Same scrypt "salt:hash" scheme used for driver PINs.
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const pw: string | undefined = body.pw;
    const email: string | undefined = body.email;
    const newPassword: string | undefined = body.newPassword;

    if (pw !== process.env.MIGRATE_SECRET) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    if (!email || !newPassword) {
      return NextResponse.json(
        { success: false, error: "email and newPassword are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const emailNorm = email.trim().toLowerCase();

    const { rows } = await sql`
      SELECT id, name, email, role FROM users
      WHERE lower(email) = ${emailNorm}
      LIMIT 1;
    `;
    const user = rows[0];

    if (!user) {
      return NextResponse.json(
        { success: false, error: `No user found with email ${emailNorm}. Add them in Settings first.` },
        { status: 404 }
      );
    }

    const hashed = hashPassword(newPassword);

    // Store the hash. Promote to 'manager' only if they're not already a higher role (owner).
    await sql`
      UPDATE users
      SET password_hash = ${hashed},
          role = CASE WHEN role = 'owner' THEN role ELSE 'manager'::user_role END
      WHERE id = ${user.id};
    `;

    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
