import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createHash } from "crypto";
import { ensureSaleTables, phoneDigits } from "@/lib/sale-records";
import { normalizeVin, vinError } from "@/lib/vin";

export const dynamic = "force-dynamic";

// Public warranty lookup by phone or VIN. Returns minimal, masked data only.
// Rate limited per IP (hashed, never stored raw): 10 lookups per 10 minutes.
const WINDOW_MIN = 10;
const MAX_PER_WINDOW = 10;

async function ensureRateTable() {
  await sql`CREATE TABLE IF NOT EXISTS public_rate_limits (
    key TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    hits INT NOT NULL DEFAULT 0,
    PRIMARY KEY (key, window_start)
  )`;
}

function maskName(name: string | null) {
  if (!name) return null;
  return name
    .trim()
    .split(/\s+/)
    .map((p) => (p ? p[0].toUpperCase() + "•".repeat(Math.max(1, Math.min(p.length - 1, 4))) : ""))
    .join(" ");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawPhone = String(body?.phone ?? "").trim();
    const rawVin = String(body?.vin ?? "").trim();
    if (!rawPhone && !rawVin) {
      return NextResponse.json({ success: false, error: "Enter a phone number or VIN." }, { status: 400 });
    }
    let digits = "";
    let vin = "";
    if (rawVin) {
      vin = normalizeVin(rawVin);
      const bad = vinError(vin);
      if (bad) return NextResponse.json({ success: false, error: bad }, { status: 400 });
    } else {
      digits = phoneDigits(rawPhone);
      if (digits.length !== 10) {
        return NextResponse.json({ success: false, error: "Enter a 10-digit phone number." }, { status: 400 });
      }
    }

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    const key = createHash("sha256").update("wl:" + ip).digest("hex").slice(0, 32);
    await ensureRateTable();
    const rl = await sql`
      INSERT INTO public_rate_limits (key, window_start, hits)
      VALUES (${key}, date_bin(${WINDOW_MIN + " minutes"}::interval, now(), 'epoch'::timestamptz), 1)
      ON CONFLICT (key, window_start) DO UPDATE SET hits = public_rate_limits.hits + 1
      RETURNING hits`;
    if (Number(rl.rows[0]?.hits) > MAX_PER_WINDOW) {
      return NextResponse.json(
        { success: false, error: "Too many lookups. Please wait a few minutes and try again." },
        { status: 429 }
      );
    }
    // Housekeeping: old windows are useless; this table holds only rate-limit counters.
    await sql`DELETE FROM public_rate_limits WHERE window_start < now() - interval '1 day'`;

    await ensureSaleTables();
    const r = vin
      ? await sql`
          SELECT s.vin, s.battery_group, s.warranty_start, s.warranty_end, s.warranty_months,
                 v.year, v.make, v.model, c.name AS customer_name, co.name AS company_name
          FROM sale_records s
          LEFT JOIN vehicles v ON v.id = s.vehicle_id
          LEFT JOIN customers c ON c.id = s.customer_id
          LEFT JOIN companies co ON co.id = s.company_id
          WHERE s.vin = ${vin}
          ORDER BY s.created_at DESC LIMIT 10`
      : await sql`
          SELECT s.vin, s.battery_group, s.warranty_start, s.warranty_end, s.warranty_months,
                 v.year, v.make, v.model, c.name AS customer_name, co.name AS company_name
          FROM sale_records s
          JOIN customers c ON c.id = s.customer_id
          LEFT JOIN vehicles v ON v.id = s.vehicle_id
          LEFT JOIN companies co ON co.id = s.company_id
          WHERE c.phone_digits = ${digits}
          ORDER BY s.created_at DESC LIMIT 10`;

    const today = new Date().toISOString().slice(0, 10);
    const results = r.rows.map((x) => {
      const end = x.warranty_end ? new Date(x.warranty_end).toISOString().slice(0, 10) : null;
      return {
        customer: maskName(x.customer_name),
        vehicle: [x.year, x.make, x.model].filter(Boolean).join(" ") || null,
        vinLast6: x.vin ? String(x.vin).slice(-6) : null,
        batteryGroup: x.battery_group,
        installedBy: x.company_name,
        warrantyStart: x.warranty_start ? new Date(x.warranty_start).toISOString().slice(0, 10) : null,
        warrantyEnd: end,
        warrantyMonths: x.warranty_months,
        status: end ? (end >= today ? "active" : "expired") : "unknown",
      };
    });
    return NextResponse.json({ success: true, results });
  } catch (e) {
    console.error("warranty-lookup error", e);
    return NextResponse.json({ success: false, error: "Lookup failed. Please try again." }, { status: 500 });
  }
}
