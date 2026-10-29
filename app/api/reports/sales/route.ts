import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";
import { normalizeBatteryType } from "@/lib/battery-types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Real per-battery sales for the Analytics / Reports page. One row per sold
// battery (counted from batteries.sold_at, same rule as /api/sales/summary so
// returned_core units still count). "price" is the battery cost (cost of
// goods); warranty replacements are free and carry 0.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
  if (user.role !== "owner" && user.role !== "manager") {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }
  if (!user.orgId) return NextResponse.json({ success: true, sales: [] });

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start") || null;
  const end = searchParams.get("end") || null;

  try {
    const { rows } = await sql`
      SELECT
        b.id, b.barcode, b.sold_at, b.cost,
        COALESCE(b.is_warranty, false) AS is_warranty,
        b.sold_on_call_number,
        COALESCE(bt.code, bt.name, 'Unknown') AS battery_type,
        mdl.code AS model_code,
        COALESCE(l.name, 'Unknown location') AS location_name,
        sm.driver_id,
        COALESCE(d.name, 'Unknown driver') AS driver_name
      FROM batteries b
      JOIN companies c ON c.id = b.company_id
      LEFT JOIN battery_types bt ON bt.id = b.battery_type_id
      LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
      LEFT JOIN locations l ON l.id = b.location_id
      LEFT JOIN LATERAL (
        SELECT m.driver_id FROM battery_movements m
        WHERE m.battery_id = b.id AND m.to_status = 'sold'
        ORDER BY m.occurred_at DESC LIMIT 1
      ) sm ON true
      LEFT JOIN drivers d ON d.id = sm.driver_id
      WHERE c.org_id = ${user.orgId}
        AND b.sold_at IS NOT NULL
        AND (${start}::timestamp IS NULL OR b.sold_at >= ${start}::timestamp)
        AND (${end}::timestamp IS NULL OR b.sold_at < (${end}::date + INTERVAL '1 day'))
      ORDER BY b.sold_at DESC;
    `;

    const sales = rows.map((r) => ({
      id: r.barcode as string,
      date: new Date(r.sold_at).toLocaleDateString("en-CA", { timeZone: "America/Phoenix" }),
      batteryType: normalizeBatteryType(r.battery_type),
      model: r.model_code ?? null,
      quantity: 1,
      price: r.is_warranty ? 0 : Number(r.cost) || 0,
      isWarranty: !!r.is_warranty,
      callNumber: r.sold_on_call_number ?? null,
      teamMemberId: (r.driver_id as string) ?? "unknown",
      teamMemberName: r.driver_name as string,
      location: r.location_name as string,
    }));
    return NextResponse.json({ success: true, sales });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
