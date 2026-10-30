import { logAudit } from "@/lib/audit";
// POST { email } -> emails a single-use reset link if the account exists.
// Always returns the same neutral message so it never reveals which emails
// have accounts. Rate limited per email and per IP.
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { randomBytes } from "crypto";
import { ensureResetTable, hashToken, TOKEN_MINUTES } from "@/lib/password-reset";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NEUTRAL = {
  success: true,
  message: "If that email has an account, a reset link is on its way. Check your inbox (and spam) - the link works for 30 minutes.",
};
const PER_EMAIL_PER_HOUR = 3;
const PER_IP_PER_HOUR = 10;

function baseUrl(req: NextRequest): string {
  const env = process.env.NEXTAUTH_URL || process.env.AUTH_URL;
  if (env) return env.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "www.battery-city.com";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@") || email.length > 320) {
      return NextResponse.json({ success: false, error: "Enter your email address." }, { status: 400 });
    }
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";

    await ensureResetTable();

    const { rows: counts } = await sql`
      SELECT
        COUNT(*) FILTER (WHERE email = ${email}) AS by_email,
        COUNT(*) FILTER (WHERE ip = ${ip})       AS by_ip
      FROM password_reset_tokens
      WHERE created_at > NOW() - INTERVAL '1 hour';
    `;
    if (Number(counts[0]?.by_email) >= PER_EMAIL_PER_HOUR || Number(counts[0]?.by_ip) >= PER_IP_PER_HOUR) {
      // Same answer as success - just do nothing.
      return NextResponse.json(NEUTRAL);
    }

    const { rows } = await sql`
      SELECT id, name, email, status FROM users
      WHERE lower(email) = ${email}
      LIMIT 1;
    `;
    const user = rows[0];
    if (!user || user.status !== "active") {
      await sql`INSERT INTO password_reset_tokens (email, ip) VALUES (${email}, ${ip});`;
      return NextResponse.json(NEUTRAL);
    }

    const token = randomBytes(32).toString("hex");
    // A new link replaces any older unused ones.
    await sql`
      UPDATE password_reset_tokens SET used_at = NOW()
      WHERE user_id = ${String(user.id)} AND used_at IS NULL AND token_hash IS NOT NULL;
    `;
    await sql`
      INSERT INTO password_reset_tokens (user_id, email, ip, token_hash, expires_at)
      VALUES (${String(user.id)}, ${email}, ${ip}, ${hashToken(token)},
              NOW() + make_interval(mins => ${TOKEN_MINUTES}));
    `;

    await logAudit({ action: "password.reset_requested", actorType: "anonymous", entityType: "user", entityId: user.id, details: { email }, req });

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || "Battery City <no-reply@battery-city.com>";
    if (!apiKey) {
      console.error("[password-reset] RESEND_API_KEY is not set - reset email NOT sent for", email);
      return NextResponse.json(NEUTRAL);
    }

    const link = `${baseUrl(req)}/reset-password?token=${token}`;
    const name = (user.name as string) || "there";
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [user.email],
        subject: "Reset your Battery City password",
        text:
          `Hi ${name},\n\nSomeone asked to reset the password for your Battery City account.\n\n` +
          `Reset it here (link works for ${TOKEN_MINUTES} minutes, one time only):\n${link}\n\n` +
          `If you didn't ask for this, ignore this email - your password won't change.`,
        html:
          `<p>Hi ${name.replace(/[<>&]/g, "")},</p>` +
          `<p>Someone asked to reset the password for your Battery City account.</p>` +
          `<p><a href="${link}">Reset your password</a> - this link works for ${TOKEN_MINUTES} minutes, one time only.</p>` +
          `<p>If you didn't ask for this, ignore this email - your password won't change.</p>`,
      }),
    });
    if (!resp.ok) {
      console.error("[password-reset] Resend error", resp.status, await resp.text().catch(() => ""));
    }
    return NextResponse.json(NEUTRAL);
  } catch (err: unknown) {
    console.error("[password-reset] request failed", err);
    return NextResponse.json(NEUTRAL);
  }
}
