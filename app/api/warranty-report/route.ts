import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET: list this org's warranty replacement batteries for the supplier claim report.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
  }
  if (user.role !== "owner" && user.role !== "manager") {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }
  if (!user.orgId) {
    // Fail-closed: no tenant context returns empty rather than leaking all orgs.
    return NextResponse.json({ success: true, warranties: [], totalOwed: 0 });
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
        AND b.company_id IN (SELECT id FROM companies WHERE org_id = ${user.orgId})
      ORDER BY b.received_at ASC NULLS LAST, b.barcode ASC;
    `;

    const { rows: totalRows } = await sql`
      SELECT COALESCE(SUM(cost), 0) AS total_owed
      FROM batteries
      WHERE is_warranty = true
        AND company_id IN (SELECT id FROM companies WHERE org_id = ${user.orgId});
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

// POST: save the wholesale cost entered for one warranty battery (this org only).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
  }
  if (user.role !== "owner" && user.role !== "manager") {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }
  if (!user.orgId) {
    return NextResponse.json({ success: false, error: "No organization context." }, { status: 403 });
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

  const costNum = typeof body.cost === "string" ? parseFloat(body.cost) : body.cost;
  if (costNum === undefined || costNum === null || isNaN(Number(costNum)) || Number(costNum) < 0) {
    return NextResponse.json(
      { success: false, error: "Cost must be a non-negative number." },
      { status: 400 }
    );
  }

  try {
    // Tenant guard: only update a warranty battery whose company is in the caller's org.
    const { rows } = await sql`
      UPDATE batteries
      SET cost = ${Number(costNum)}
      WHERE id = ${batteryId}
        AND is_warranty = true
        AND company_id IN (SELECT id FROM companies WHERE org_id = ${user.orgId})
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
