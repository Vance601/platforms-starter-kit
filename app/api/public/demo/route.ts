// POST { name, email, company?, phone?, website (honeypot), referrer?, utm? }
// One-click demo, gated by a short lead form. Creates an isolated demo org
// (expires in 7 days) with fake Las Vegas data and signs the visitor in as its
// owner. Every start (new or resumed) is written to demo_leads.
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createDemoOrg, liveDemoOwner } from "@/lib/demo";
import { setManagerSession, verifyManagerSession, requestHost } from "@/lib/manager-session";
import { overLimit, clientIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { ensureDemoLeadsTable, deviceOf } from "@/lib/demo-leads";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NOTIFY_TO = "vancedugger@icloud.com";
const clip = (v: unknown, n: number) => {
  const s = String(v ?? "").trim().slice(0, n);
  return s || null;
};
const header = (req: NextRequest, k: string) => {
  const v = req.headers.get(k);
  if (!v) return null;
  try { return decodeURIComponent(v).slice(0, 120); } catch { return v.slice(0, 120); }
};

type Lead = { name: string; email: string; company: string | null; phone: string | null; referrer: string | null; utm: Record<string, string | null> };

async function recordLead(req: NextRequest, lead: Lead, ownerUserId: string, resumed: boolean) {
  try {
    await ensureDemoLeadsTable();
    const { rows: o } = await sql`SELECT org_id FROM users WHERE id = ${ownerUserId} LIMIT 1;`;
    const orgId = (o[0]?.org_id as string) ?? null;
    if (resumed && orgId) {
      // Same person coming back to the same demo: count a login, don't add a row.
      const { rowCount } = await sql`
        UPDATE demo_leads SET logins = logins + 1, last_seen = now()
        WHERE demo_org_id = ${orgId} AND lower(email) = ${lead.email};`;
      if (rowCount) return;
    }
    const ua = (req.headers.get("user-agent") || "").slice(0, 400);
    const { rows } = await sql`
      INSERT INTO demo_leads (name, email, company, phone, demo_org_id, ip, city, region, country,
        user_agent, device, referrer, utm_source, utm_medium, utm_campaign, utm_term, utm_content, resumed, last_seen)
      VALUES (${lead.name}, ${lead.email}, ${lead.company}, ${lead.phone}, ${orgId}, ${clientIp(req)},
        ${header(req, "x-vercel-ip-city")}, ${header(req, "x-vercel-ip-country-region")}, ${header(req, "x-vercel-ip-country")},
        ${ua}, ${deviceOf(ua)}, ${lead.referrer}, ${lead.utm.utm_source}, ${lead.utm.utm_medium}, ${lead.utm.utm_campaign},
        ${lead.utm.utm_term}, ${lead.utm.utm_content}, ${resumed}, now())
      RETURNING id, city, region, country;`;
    await notify(lead, rows[0], resumed);
  } catch (e) {
    console.error("[demo] lead log failed", e); // never block the demo
  }
}

async function notify(lead: Lead, row: Record<string, unknown> | undefined, resumed: boolean) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  // Test leads never trigger a notice.
  if (/^test-bot/i.test(lead.name) || lead.email.endsWith("@example.com")) return;
  const where = [row?.city, row?.region, row?.country].filter(Boolean).join(", ") || "unknown location";
  const lines = [
    `Name: ${lead.name}`, `Email: ${lead.email}`, `Company: ${lead.company || "-"}`, `Phone: ${lead.phone || "-"}`,
    `Location: ${where}`, `Referrer: ${lead.referrer || "-"}`,
    `UTM: ${Object.entries(lead.utm).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(" ") || "-"}`,
    resumed ? "(Returning visitor - reused an existing demo)" : "",
    "", "All leads: https://www.battery-city.com/admin/demo-leads",
  ].filter((l) => l !== "");
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Battery City <no-reply@battery-city.com>",
        to: [NOTIFY_TO],
        subject: `New demo lead: ${lead.name}${lead.company ? ` (${lead.company})` : ""}`,
        text: lines.join("\n"),
      }),
    });
    if (!r.ok) console.error("[demo] lead notice failed", r.status, await r.text().catch(() => ""));
    else console.log("[demo] lead notice sent", (await r.json().catch(() => ({})))?.id);
  } catch (e) {
    console.error("[demo] lead notice error", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    // Honeypot: real people never see or fill "website".
    if (String(body.website ?? "").trim()) {
      return NextResponse.json({ success: false, error: "Could not start the demo." }, { status: 400 });
    }
    const name = clip(body.name, 120);
    const email = clip(body.email, 200)?.toLowerCase() ?? null;
    if (!name || name.length < 2) return NextResponse.json({ success: false, error: "Please enter your name." }, { status: 400 });
    if (!email || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
      return NextResponse.json({ success: false, error: "Please enter a valid email address." }, { status: 400 });
    }
    const phone = clip(body.phone, 40);
    if (phone && !/^[0-9+().\-\s]{7,40}$/.test(phone)) {
      return NextResponse.json({ success: false, error: "That phone number doesn't look right." }, { status: 400 });
    }
    const u = (body.utm && typeof body.utm === "object") ? body.utm : {};
    const lead: Lead = {
      name, email, phone, company: clip(body.company, 160), referrer: clip(body.referrer, 500),
      utm: Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].map((k) => [k, clip(u[k], 200)])),
    };

    const ip = clientIp(req);
    const resume = async (userId: string) => {
      await recordLead(req, lead, userId, true);
      const res = NextResponse.json({ success: true, redirect: "/", resumed: true });
      setManagerSession(res, userId, 60 * 60 * 24, requestHost(req));
      return res;
    };
    // 1) Already holding a valid session for a live demo: just continue it.
    const sessUser = verifyManagerSession(req.cookies.get("manager_session")?.value);
    if (sessUser) {
      const owner = await liveDemoOwner({ userId: sessUser });
      if (owner) return resume(owner);
    }
    // 2) Per-IP limit hit: reuse this IP's most recent live demo if any.
    if (await overLimit(`demo:ip:${ip}`, 60, 5)) {
      const owner = await liveDemoOwner({ ip });
      if (owner) return resume(owner);
      return NextResponse.json({ success: false, error: "You've started several demos recently. Please try again in an hour." }, { status: 429 });
    }
    if (await overLimit("demo:all", 60 * 24, 200)) {
      const owner = await liveDemoOwner({ ip });
      if (owner) return resume(owner);
      return NextResponse.json({ success: false, error: "The demo is very busy today. Please sign up instead or try again tomorrow." }, { status: 429 });
    }
    const demo = await createDemoOrg(ip);
    await logAudit({ action: "demo.created", actorType: "manager", actorId: demo.userId, orgId: demo.orgId, entityType: "organization", entityId: demo.orgId, req });
    await recordLead(req, lead, demo.userId, false);
    const res = NextResponse.json({ success: true, redirect: "/" });
    setManagerSession(res, demo.userId, 60 * 60 * 24, requestHost(req));
    return res;
  } catch (err) {
    console.error("[demo] create failed", err);
    return NextResponse.json({ success: false, error: "Could not create the demo right now. Please try again." }, { status: 500 });
  }
}
