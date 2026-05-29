import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Live activity feed: most recent battery movements + core resolutions,
// joined to driver names and battery barcodes for human-readable rows.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Not signed in." },
        { status: 401 }
      );
    }

    // Recent battery movements (load, sell, core return) — driver + battery.
    const { rows: movements } = await sql`
      SELECT
        bm.id,
        bm.occurred_at AS at,
        bm.from_status,
        bm.to_status,
        bm.call_reference,
        b.barcode AS barcode,
        d.name AS driver_name,
        t.truck_number AS truck_number,
        bm.notes
      FROM battery_movements bm
      LEFT JOIN drivers   d ON d.id = bm.driver_id
      LEFT JOIN batteries b ON b.id = bm.battery_id
      LEFT JOIN trucks    t ON t.id = COALESCE(bm.to_truck_id, bm.from_truck_id)
      ORDER BY bm.occurred_at DESC NULLS LAST
      LIMIT 30;
    `;

    // Recent core resolutions (returned / customer_kept).
    const { rows: cores } = await sql`
      SELECT
        cr.id,
        cr.returned_at AS at,
        cr.status,
        cr.deposit_amount,
        cr.notes,
        b.barcode AS barcode
      FROM core_returns cr
      LEFT JOIN batteries b ON b.id = cr.battery_id
      WHERE cr.status IN ('returned','customer_kept')
        AND cr.returned_at IS NOT NULL
      ORDER BY cr.returned_at DESC NULLS LAST
      LIMIT 30;
    `;

    type FeedItem = {
      id: string;
      at: string | null;
      kind: "load" | "sell" | "core_return_battery" | "core_returned" | "core_kept" | "other";
      headline: string;
      detail: string | null;
    };

    const events: FeedItem[] = [];

    for (const m of movements) {
      const driver = (m.driver_name as string | null) || "A driver";
      const barcode = (m.barcode as string | null) || "battery";
      const truck = m.truck_number ? `truck #${m.truck_number}` : "a truck";
      const from = m.from_status as string;
      const to   = m.to_status as string;

      let kind: FeedItem["kind"] = "other";
      let headline = `${from} → ${to}`;
      let detail: string | null = (m.notes as string | null) || null;

      if (from === "in_warehouse" && to === "on_truck") {
        kind = "load";
        headline = `${driver} loaded ${barcode} onto ${truck}`;
      } else if (from === "on_truck" && to === "sold") {
        kind = "sell";
        const call = m.call_reference ? ` (call #${m.call_reference})` : "";
        headline = `${driver} sold ${barcode}${call}`;
      } else if (from === "sold" && to === "returned_core") {
        kind = "core_return_battery";
        headline = `${driver} returned core ${barcode} to MBS`;
      }

      events.push({
        id: `m-${m.id}`,
        at: (m.at as string | null) ?? null,
        kind,
        headline,
        detail,
      });
    }

    for (const c of cores) {
      const barcode = (c.barcode as string | null) || "battery";
      const isKept  = c.status === "customer_kept";
      const amt     = c.deposit_amount != null ? Number(c.deposit_amount).toFixed(2) : null;
      events.push({
        id: `c-${c.id}`,
        at: (c.at as string | null) ?? null,
        kind: isKept ? "core_kept" : "core_returned",
        headline: isKept
          ? `Customer kept core for ${barcode}${amt ? ` — $${amt} charge recorded` : ""}`
          : `Core for ${barcode} marked returned to MBS`,
        detail: (c.notes as string | null) || null,
      });
    }

    // Sort the merged list by timestamp, newest first; cap at 30.
    events.sort((a, b) => {
      const av = a.at ? new Date(a.at).getTime() : 0;
      const bv = b.at ? new Date(b.at).getTime() : 0;
      return bv - av;
    });
    const feed = events.slice(0, 30);

    return NextResponse.json({ success: true, feed });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, feed: [], error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}
