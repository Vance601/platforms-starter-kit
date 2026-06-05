// app/api/print-labels/route.ts
// GET (no query)        -> list delivery receipts for the picker
// GET ?deliveryId=<id>  -> list batteries in that delivery (for label printing)
// Owner-only: ?pw= checked against MIGRATE_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function checkPw(req: NextRequest): boolean {
  const pw = req.nextUrl.searchParams.get("pw");
  return pw === process.env.MIGRATE_SECRET;
}

export async function GET(req: NextRequest) {
  if (!checkPw(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const deliveryId = req.nextUrl.searchParams.get("deliveryId");

  try {
    // No deliveryId -> return the list of deliveries for the dropdown.
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
        LEFT JOIN batteries b ON b.delivery_receipt_id = dr.id
        GROUP BY dr.id, dr.supplier, dr.receipt_number, dr.po_number, dr.receipt_date, dr.total_units
        ORDER BY dr.receipt_date DESC NULLS LAST;
      `;
      return NextResponse.json({ success: true, deliveries });
    }

    // deliveryId given -> return the batteries in that delivery for labelling.
    const { rows: batteries } = await sql`
      SELECT
        b.id,
        b.barcode,
        COALESCE(mdl.code, '') AS model_code
      FROM batteries b
      LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
      WHERE b.delivery_receipt_id = ${deliveryId}
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
