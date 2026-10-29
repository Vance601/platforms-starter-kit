import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";
import { getCoreLedger } from "@/lib/core-ledger";
import { normalizeBatteryType } from "@/lib/battery-types";

export const dynamic = "force-dynamic";

// Alerts are DERIVED from live data every request -- nothing is stored:
//  - inventory: warehouse stock per location x battery type below the type's
//    par_level_min (battery_types table).
//  - core-return: drivers with cores still owed (shared core ledger).
// Each alert carries a "signature" of the numbers that triggered it. The page
// stores resolutions against id+signature, so a resolved alert stays resolved
// until the underlying numbers change.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "owner" && user.role !== "manager") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (!user.orgId) return NextResponse.json({ alerts: [], locations: [] });

  try {
    const { rows: stock } = await sql`
      SELECT l.id AS location_id, l.name AS location_name,
             bt.code AS type_code, COALESCE(bt.par_level_min, 0)::int AS threshold,
             COUNT(b.id)::int AS current
      FROM locations l
      JOIN companies c ON c.id = l.company_id
      CROSS JOIN battery_types bt
      LEFT JOIN batteries b ON b.location_id = l.id
        AND b.battery_type_id = bt.id AND b.status = 'in_warehouse'
      WHERE c.org_id = ${user.orgId} AND l.active = TRUE
      GROUP BY l.id, l.name, bt.code, bt.par_level_min
      ORDER BY l.name, bt.code;
    `;

    const now = new Date().toISOString();
    const alerts: Record<string, unknown>[] = [];
    for (const r of stock) {
      const threshold = Number(r.threshold) || 0;
      const current = Number(r.current) || 0;
      if (threshold <= 0 || current >= threshold) continue;
      const type = normalizeBatteryType(r.type_code);
      alerts.push({
        id: `inv:${r.location_id}:${r.type_code}`,
        signature: `${current}/${threshold}`,
        type: "inventory",
        item: `${type} Batteries`,
        batteryType: type,
        location: r.location_name,
        current,
        threshold,
        severity: current === 0 || current < threshold / 2 ? "critical" : "warning",
        date: now,
      });
    }

    const ledger = await getCoreLedger(user.orgId);
    const owed = new Map<string, { name: string; count: number; oldest: string | null }>();
    for (const r of ledger) {
      if (r.core_state !== "owed") continue;
      const k = r.driver_id ?? "unknown";
      const e = owed.get(k) ?? { name: r.driver_name, count: 0, oldest: null };
      e.count++;
      const sold = r.sold_at ? new Date(r.sold_at).toISOString() : null;
      if (sold && (!e.oldest || sold < e.oldest)) e.oldest = sold;
      owed.set(k, e);
    }
    for (const [k, e] of Array.from(owed.entries())) {
      const ageDays = e.oldest ? (Date.now() - new Date(e.oldest).getTime()) / 86400000 : 0;
      alerts.push({
        id: `core:${k}`,
        signature: String(e.count),
        type: "core-return",
        item: `Cores owed — ${e.name}`,
        location: e.name,
        count: e.count,
        severity: e.count >= 5 || ageDays > 14 ? "critical" : "warning",
        date: e.oldest ?? now,
      });
    }

    const locations = Array.from(new Set(stock.map((r) => r.location_name as string))).sort();
    return NextResponse.json({ alerts, locations });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
