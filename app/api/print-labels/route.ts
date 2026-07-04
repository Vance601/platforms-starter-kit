// app/api/print-labels/route.ts
// GET (no query)        -> list delivery receipts for the picker (org-scoped)
// GET ?deliveryId=<id>  -> list batteries in that delivery (org-scoped)
// Owner/manager only, via session. No password in the URL.

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
  }
  if (user.role !== "owner" && user.role !== "manager") {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }
  if (!user.orgId) {
    // Fail-closed: no tenant context means no data rather than a leak.
    return NextResponse.json({ success: true, deliveries: [], batteries: [] });
  }

  const deliveryId = req.nextUrl.searchParams.get("deliveryId");

  try {
    // No deliveryId -> list deliveries whose company belongs to the caller's org.
    if (!deliveryId) {
      const { rows: deliveries } = await sql`
        SELECT
          dr.id,
          dr.supplier,
          dr.receipt_number,
          dr.po_number,
          dr.receipt_date,
          dr.total_units,
          COUNT(b.id)::int AS battery_count
        FROM delivery_receipts dr
        JOIN companies c ON c.id = dr.company_id
        LEFT JOIN batteries b ON b.delivery_receipt_id = dr.id
        WHERE c.org_id = ${user.orgId}
        GROUP BY dr.id, dr.supplier, dr.receipt_number, dr.po_number, dr.receipt_date, dr.total_units
        ORDER BY dr.receipt_date DESC NULLS LAST;
      `;
      return NextResponse.json({ success: true, deliveries });
    }

    // deliveryId given -> return that delivery's batteries, but ONLY if the
    // delivery's company is in the caller's org. Cross-tenant ids match nothing.
    const { rows: batteries } = await sql`
      SELECT
        b.id,
        b.barcode,
        COALESCE(mdl.code, '') AS model_code
      FROM batteries b
      JOIN delivery_receipts dr ON dr.id = b.delivery_receipt_id
      JOIN companies c ON c.id = dr.company_id
      LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
      WHERE b.delivery_receipt_id = ${deliveryId}
        AND c.org_id = ${user.orgId}
      ORDER BY b.barcode ASC;
    `;
    return NextResponse.json({ success: true, batteries });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
