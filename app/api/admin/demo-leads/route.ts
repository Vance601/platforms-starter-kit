// Platform-owner only: the demo lead log.
// GET ?q=search            -> { leads }
// GET ?format=csv&q=...    -> CSV download
// GET ?check=1             -> { platform: boolean } (sidebar link)
// DELETE ?id=N             -> remove one lead row (test cleanup)
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";
import { ensureDemoLeadsTable, isPlatformOwner, refreshLeadStats } from "@/lib/demo-leads";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const COLS = ["id", "created_at", "name", "email", "company", "phone", "city", "region", "country", "device", "user_agent",
  "referrer", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ip", "demo_org_id", "resumed",
  "last_seen", "logins", "actions", "sales"];

const phx = (v: unknown) =>
  v ? new Date(String(v)).toLocaleString("en-US", { timeZone: "America/Phoenix", year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit" }) : "";

export async function GET(req: NextRequest) {
  const u = await getCurrentUser();
  const ok = await isPlatformOwner(u);
  const sp = req.nextUrl.searchParams;
  if (sp.get("check")) return NextResponse.json({ success: true, platform: ok });
  if (!u) return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
  if (!ok) return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  try {
    await ensureDemoLeadsTable();
    await refreshLeadStats();
    const q = `%${(sp.get("q") || "").trim().toLowerCase()}%`;
    const { rows } = await sql`
      SELECT * FROM demo_leads
      WHERE ${q} = '%%' OR lower(concat_ws(' ', name, email, company, phone, city, region, country, referrer, utm_source, utm_campaign)) LIKE ${q}
      ORDER BY created_at DESC LIMIT 2000;`;
    if (sp.get("format") === "csv") {
      const esc = (v: unknown) => {
        let s = v === null || v === undefined ? "" : String(v);
        if (/^[=+\-@]/.test(s)) s = "'" + s; // no spreadsheet formulas
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const head = COLS.map((c) => (c === "created_at" ? "created_at_phoenix" : c === "last_seen" ? "last_seen_phoenix" : c));
      const lines = [head.join(",")].concat(
        rows.map((r) => COLS.map((c) => esc(c === "created_at" || c === "last_seen" ? phx(r[c]) : r[c])).join(","))
      );
      return new NextResponse(lines.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="demo-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }
    return NextResponse.json({ success: true, leads: rows });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const u = await getCurrentUser();
  if (!(await isPlatformOwner(u))) return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ success: false, error: "Bad id." }, { status: 400 });
  await ensureDemoLeadsTable();
  const { rows } = await sql`DELETE FROM demo_leads WHERE id = ${id} RETURNING email;`;
  await logAudit({ action: "demo_lead.deleted", actorType: "manager", actorId: u!.userId, orgId: u!.orgId, entityType: "demo_lead", entityId: id, details: { email: rows[0]?.email ?? null }, req });
  return NextResponse.json({ success: true, deleted: rows.length });
}
