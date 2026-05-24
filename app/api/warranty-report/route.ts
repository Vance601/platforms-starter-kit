import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Owner-only. Matches the admin pattern: ?pw= checked against MIGRATE_SECRET.
function checkPw(req: NextRequest): boolean {
  const pw = req.nextUrl.searchParams.get("pw");
  return pw === process.env.MIGRATE_SECRET;
}

// GET: list every warranty replacement battery for the MBS claim report.
// Columns the report needs: original purchase date (received_at),
// Towbook call number (sold_on_call_number), and the wholesale cost paid to MBS (cost).
// Also reports whether the warranty core has been returned yet (status = 'returned_core'),
// shown for visibility — it does NOT filter the list (we report ALL warranties).
export async function GET(req: NextRequest) {
  if (!checkPw(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { rows: warranties } = await sql`
      SELECT
        b.id,
        b.barcode,
        b.received_at,
        b.sold_on_call_number,
        b.cost,
        b.status::text AS status,
        (b.status = 'returned_core') AS core_returned
      FROM batteries b
      WHERE b.is_warranty = true
      ORDER BY b.received_at ASC NULLS LAST, b.barcode ASC;
    `;

    // Total wholesale cost MBS owes = sum of entered costs across all warranties.
    const { rows: totalRows } = await sql`
      SELECT COALESCE(SUM(cost), 0) AS total_owed
      FROM batteries
      WHERE is_warranty = true;
    `;

    return NextResponse.json({
      success: true,
      warranties,
      totalOwed: totalRows[0].total_owed,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST: save the wholesale cost entered for one warranty battery.
// Writes to batteries.cost (Option A). Only touches warranty batteries.
export async function POST(req: NextRequest) {
  if (!checkPw(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: { batteryId?: string; cost?: number | string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const batteryId = body.batteryId;
  if (!batteryId) {
    return NextResponse.json({ success: false, error: "batteryId is required." }, { status: 400 });
  }

  // Parse and validate the cost. Must be a non-negative number.
  const costNum = typeof body.cost === "string" ? parseFloat(body.cost) : body.cost;
  if (costNum === undefined || costNum === null || isNaN(Number(costNum)) || Number(costNum) < 0) {
    return NextResponse.json(
      { success: false, error: "Cost must be a non-negative number." },
      { status: 400 }
    );
  }

  try {
    // Only update if the battery is actually a warranty battery — guard against
    // accidentally rewriting a normal sale's cost through this endpoint.
    const { rows } = await sql`
      UPDATE batteries
      SET cost = ${Number(costNum)}
      WHERE id = ${batteryId} AND is_warranty = true
      RETURNING id, cost;
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Warranty battery not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, batteryId: rows[0].id, cost: rows[0].cost });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
