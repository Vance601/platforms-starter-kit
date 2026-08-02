// app/api/print-labels/route.ts
// GET (no query)        -> list label batches for the picker (org-scoped)
// GET ?deliveryId=<id>  -> list batteries in that batch (org-scoped)
// Owner/manager only, via session. No password in the URL.
//
// Batteries arrive by TWO paths: a delivery receipt (day 0, no cost) or an MBS
// invoice. Listing only delivery_receipts meant invoice-received stock could
// never be labelled. Both are listed here, with the id prefixed so the second
// call knows which table to look in:
//   dr:<uuid>  = delivery receipt
//   inv:<uuid> = MBS invoice
// Bare uuids are still treated as delivery receipts for backward compatibility.

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

  const raw = req.nextUrl.searchParams.get("deliveryId");

  try {
    // ---------- No id: list every batch that has batteries to label ----------
    if (!raw) {
      const { rows: receipts } = await sql`
        SELECT
          'dr:' || dr.id            AS id,
          dr.supplier               AS supplier,
          dr.receipt_number         AS reference,
          dr.receipt_date           AS batch_date,
          COUNT(b.id)::int          AS battery_count,
          'Delivery receipt'        AS source
        FROM delivery_receipts dr
        JOIN companies c ON c.id = dr.company_id
        LEFT JOIN batteries b ON b.delivery_receipt_id = dr.id
        WHERE c.org_id = ${user.orgId}
        GROUP BY dr.id, dr.supplier, dr.receipt_number, dr.receipt_date;
      `;

      // mbs_invoices has no supplier_id - it carries location_id instead,
      // so invoice batches are labelled by location.
      const { rows: invoices } = await sql`
        SELECT
          'inv:' || i.id                     AS id,
          COALESCE(l.name, 'Invoice')        AS supplier,
          i.invoice_number                   AS reference,
          i.invoice_date                     AS batch_date,
          COUNT(b.id)::int                   AS battery_count,
          'Invoice'                          AS source
        FROM mbs_invoices i
        JOIN companies c ON c.id = i.company_id
        LEFT JOIN locations l ON l.id = i.location_id
        LEFT JOIN batteries b ON b.mbs_invoice_id = i.id
        WHERE c.org_id = ${user.orgId}
        GROUP BY i.id, l.name, i.invoice_number, i.invoice_date;
      `;

      // Empty batches are noise in the picker - hide them.
      const deliveries = [...receipts, ...invoices]
        .filter((d) => Number(d.battery_count) > 0)
        .sort((a, b) => {
          const ad = a.batch_date ? new Date(a.batch_date as string).getTime() : 0;
          const bd = b.batch_date ? new Date(b.batch_date as string).getTime() : 0;
          return bd - ad;
        });

      return NextResponse.json({ success: true, deliveries });
    }

    // ---------- Id given: return that batch's batteries ----------
    const isInvoice = raw.startsWith("inv:");
    const id = raw.replace(/^(dr:|inv:)/, "");

    if (isInvoice) {
      const { rows: batteries } = await sql`
        SELECT
          b.id,
          b.barcode,
          COALESCE(mdl.code, '') AS model_code
        FROM batteries b
        JOIN mbs_invoices i ON i.id = b.mbs_invoice_id
        JOIN companies c    ON c.id = i.company_id
        LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
        WHERE b.mbs_invoice_id = ${id}
          AND c.org_id = ${user.orgId}
        ORDER BY b.barcode ASC;
      `;
      return NextResponse.json({ success: true, batteries });
    }

    const { rows: batteries } = await sql`
      SELECT
        b.id,
        b.barcode,
        COALESCE(mdl.code, '') AS model_code
      FROM batteries b
      JOIN delivery_receipts dr ON dr.id = b.delivery_receipt_id
      JOIN companies c ON c.id = dr.company_id
      LEFT JOIN battery_models mdl ON mdl.id = b.battery_model_id
      WHERE b.delivery_receipt_id = ${id}
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
