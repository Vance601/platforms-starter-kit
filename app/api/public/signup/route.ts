// POST: public self sign-up. Validates, rate limits, stores a pending sign-up
// and emails a one-time verification link ONLY to the address being signed up.
// The org and account are created when that link is opened (./verify).
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { randomBytes } from "crypto";
import { hashPassword, hashToken } from "@/lib/password-reset";
import { validateSettingsInput } from "@/lib/org-settings";
import { overLimit, clientIp } from "@/lib/rate-limit";
import { ensurePendingSignups, appBaseUrl } from "@/lib/public-signup";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NEUTRAL = {
  success: true,
  message: "Check your email for a link to finish setting up your account. The link works for 24 hours.",
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 120);
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const orgName = String(body.orgName ?? "").trim().slice(0, 120);
  const locationName = String(body.locationName ?? "").trim().slice(0, 120);
  const city = String(body.city ?? "").trim().slice(0, 80);
  const state = String(body.state ?? "").trim().slice(0, 40);

  if (!name || !orgName || !locationName) {
    return NextResponse.json({ success: false, error: "Your name, company name and first location are required." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return NextResponse.json({ success: false, error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 200) {
    return NextResponse.json({ success: false, error: "Password must be at least 8 characters." }, { status: 400 });
  }
  const settings = validateSettingsInput(body);
  if (!settings.ok) return NextResponse.json({ success: false, error: settings.error }, { status: 400 });

  try {
    const ip = clientIp(req);
    if ((await overLimit(`signup:ip:${ip}`, 60, 5)) || (await overLimit(`signup:email:${email}`, 60, 3))) {
      return NextResponse.json({ success: false, error: "Too many sign-up attempts. Please try again later." }, { status: 429 });
    }

    // Never reveal whether an email already has an account.
    const { rows: existing } = await sql`SELECT 1 FROM users WHERE lower(email) = ${email} LIMIT 1;`;
    if (existing.length > 0) return NextResponse.json(NEUTRAL);

    await ensurePendingSignups();
    const token = randomBytes(32).toString("hex");
    const payload = {
      name, email, orgName, locationName, city, state,
      passwordHash: hashPassword(password),
      settings: settings.value,
    };
    await sql`
      INSERT INTO pending_signups (email, token_hash, payload, ip, expires_at)
      VALUES (${email}, ${hashToken(token)}, ${JSON.stringify(payload)}::jsonb, ${ip}, now() + interval '24 hours');
    `;
    await logAudit({ action: "signup.requested", actorType: "anonymous", details: { email, orgName }, req });

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || "Battery City <no-reply@battery-city.com>";
    if (!apiKey) {
      console.error("[signup] RESEND_API_KEY is not set - verification email NOT sent for", email);
      return NextResponse.json(NEUTRAL);
    }
    const link = `${appBaseUrl(req)}/api/public/signup/verify?token=${token}`;
    const safe = (s: string) => s.replace(/[<>&"]/g, "");
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email], // only the person signing up
        subject: "Confirm your Battery City account",
        text:
          `Hi ${name},\n\nConfirm your email to finish creating ${orgName} on Battery City:\n${link}\n\n` +
          `The link works for 24 hours, one time only. If you didn't sign up, ignore this email.`,
        html:
          `<p>Hi ${safe(name)},</p><p>Confirm your email to finish creating <b>${safe(orgName)}</b> on Battery City.</p>` +
          `<p><a href="${link}">Confirm and open my account</a></p>` +
          `<p>The link works for 24 hours, one time only. If you didn't sign up, ignore this email.</p>`,
      }),
    });
    if (!resp.ok) console.error("[signup] Resend error", resp.status, await resp.text().catch(() => ""));
    return NextResponse.json(NEUTRAL);
  } catch (err) {
    console.error("[signup] failed", err);
    return NextResponse.json({ success: false, error: "Could not start sign-up. Please try again." }, { status: 500 });
  }
}
