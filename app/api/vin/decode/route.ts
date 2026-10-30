import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getDriverContext } from "@/lib/driver-session";
import { normalizeVin, vinError, decodeVin } from "@/lib/vin";
import { ensureSaleTables, DEFAULT_WARRANTY_MONTHS, WARRANTY_TERMS } from "@/lib/sale-records";
import { askClaudeJson } from "@/lib/anthropic";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

// VIN-first sale, step 1: validate + decode the VIN, recommend a battery group,
// and list the batteries on the driver's truck that match. Writes only to the
// vin_decode_cache table.
export async function POST(req: NextRequest) {
  try {
    const ctx = await getDriverContext(req);
    if (!ctx) return NextResponse.json({ success: false, error: "Not signed in. Please log in again." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const vin = normalizeVin(String(body?.vin ?? ""));
    const bad = vinError(vin);
    if (bad) return NextResponse.json({ success: false, error: bad, vin }, { status: 400 });

    await ensureSaleTables();
    let vehicle;
    try {
      vehicle = await decodeVin(vin);
    } catch (e) {
      return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "VIN lookup failed.", vin }, { status: 502 });
    }

    const { rows: modelRows } = await sql`SELECT code FROM battery_models WHERE active IS NOT FALSE ORDER BY code;`;
    const validCodes = modelRows.map((r) => String(r.code));

    // 1) This org's own history for the same year/make/model/engine.
    let recommendation: { group: string; source: "history" | "ai"; detail: string } | null = null;
    const history: { group: string; count: number }[] = [];
    if (vehicle.make && vehicle.model) {
      const { rows } = await sql`
        SELECT sr.battery_group AS grp, COUNT(*)::int AS n
        FROM sale_records sr JOIN vehicles v ON v.id = sr.vehicle_id
        WHERE sr.org_id IS NOT DISTINCT FROM ${ctx.orgId}
          AND sr.battery_group IS NOT NULL
          AND v.year IS NOT DISTINCT FROM ${vehicle.year}
          AND lower(v.make) = lower(${vehicle.make})
          AND lower(v.model) = lower(${vehicle.model})
          AND v.engine IS NOT DISTINCT FROM ${vehicle.engine}
        GROUP BY sr.battery_group ORDER BY n DESC LIMIT 5;`;
      for (const r of rows) history.push({ group: String(r.grp), count: Number(r.n) });
    }
    if (history[0]) {
      const total = history.reduce((a, h) => a + h.count, 0);
      recommendation = {
        group: history[0].group,
        source: "history",
        detail: `Your team installed group ${history[0].group} in ${history[0].count} of ${total} past sales for this year, make, model and engine.`,
      };
    }

    // 2) AI suggestion — clearly labelled, never treated as verified fitment.
    let aiNote: string | null = null;
    if (!recommendation && vehicle.make && vehicle.model && validCodes.length) {
      const ai = await askClaudeJson([{
        type: "text",
        text: `Vehicle: ${vehicle.year ?? ""} ${vehicle.make} ${vehicle.model}, engine ${vehicle.engine ?? "unknown"}.
Which BCI battery group size does this vehicle most commonly use? Choose ONLY from these codes: ${validCodes.join(", ")}.
Reply with JSON only: {"group": "<one code from the list, or empty if unsure>", "note": "<one short sentence>"}`,
      }]).catch(() => null);
      const g = typeof ai?.group === "string" ? ai.group.trim().toUpperCase() : "";
      const match = validCodes.find((c) => c.toUpperCase() === g);
      if (match) {
        aiNote = typeof ai?.note === "string" ? ai.note.slice(0, 200) : null;
        recommendation = { group: match, source: "ai", detail: "AI suggestion — not verified fitment data. Check the old battery before installing." };
      }
    }

    // Batteries on the driver's truck, with their group code.
    let truckBatteries: { id: string; barcode: string; serial_number: string | null; group: string | null }[] = [];
    if (ctx.truckId) {
      const { rows } = await sql`
        SELECT b.id, b.barcode, b.serial_number, bm.code AS grp
        FROM batteries b LEFT JOIN battery_models bm ON bm.id = b.battery_model_id
        WHERE b.status = 'on_truck' AND b.truck_id = ${ctx.truckId} AND b.company_id = ${ctx.companyId}
        ORDER BY b.barcode;`;
      truckBatteries = rows.map((r) => ({ id: r.id, barcode: r.barcode, serial_number: r.serial_number ?? null, group: r.grp ?? null }));
    }

    return NextResponse.json({
      success: true,
      vehicle,
      recommendation,
      aiNote,
      history,
      validCodes,
      truckBatteries,
      hasTruck: Boolean(ctx.truckId),
      warrantyTerms: WARRANTY_TERMS,
      defaultWarrantyMonths: DEFAULT_WARRANTY_MONTHS,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
