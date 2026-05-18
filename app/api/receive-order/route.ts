import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { auth } from "@/lib/auth";
import { generateNextBarcode } from "@/lib/barcode";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const action = body.action;

  try {
    if (action === "createInvoice") {
      const { invoiceNumber, locationId, totalAmount, batteryCount, invoiceDate } = body;

      if (!invoiceNumber || !locationId || !totalAmount || !batteryCount) {
        return NextResponse.json(
          { error: "Missing required fields: invoiceNumber, locationId, totalAmount, batteryCount" },
          { status: 400 }
        );
      }

      const { rows: locations } = await sql`
        SELECT company_id FROM locations WHERE id = ${locationId};
      `;
      if (locations.length === 0) {
        return NextResponse.json({ error: "Location not found" }, { status: 404 });
      }
      const companyId = locations[0].company_id;

      const invoiceId = crypto.randomUUID();
      const parsedDate = invoiceDate ? new Date(invoiceDate) : new Date();

      await sql`
        INSERT INTO mbs_invoices
          (id, invoice_number, company_id, location_id, invoice_date,
           total_amount, battery_count, status, uploaded_by_id, uploaded_at)
        VALUES
          (${invoiceId}, ${invoiceNumber}, ${companyId}, ${locationId},
           ${parsedDate.toISOString()}, ${totalAmount}, ${batteryCount},
           'pending_verification', ${session.user.id}, NOW());
      `;

      return NextResponse.json({
        success: true,
        invoiceId,
        invoiceNumber,
        expectedCount: batteryCount,
      });
    }

    if (action === "addBattery") {
      const { invoiceId, batteryTypeCode } = body;

      if (!invoiceId || !batteryTypeCode) {
        return NextResponse.json(
          { error: "Missing required fields: invoiceId, batteryTypeCode" },
          { status: 400 }
        );
      }

      const { rows: invoices } = await sql`
        SELECT mbs_invoices.id, mbs_invoices.company_id, mbs_invoices.location_id,
               companies.slug AS company_slug
        FROM mbs_invoices
        JOIN companies ON companies.id = mbs_invoices.company_id
        WHERE mbs_invoices.id = ${invoiceId};
      `;
      if (invoices.length === 0) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }
      const invoice = invoices[0];

      const { rows: types } = await sql`
        SELECT id, default_cost FROM battery_types WHERE code = ${batteryTypeCode};
      `;
      if (types.length === 0) {
        return NextResponse.json({ error: "Battery type not found" }, { status: 404 });
      }
      const batteryType = types[0];

      const barcode = await generateNextBarcode(invoice.company_slug, batteryTypeCode);
      const batteryId = crypto.randomUUID();

      await sql`
        INSERT INTO batteries
          (id, barcode, battery_type_id, company_id, location_id,
           status, cost, mbs_invoice_id, received_at, created_at)
        VALUES
          (${batteryId}, ${barcode}, ${batteryType.id}, ${invoice.company_id},
           ${invoice.location_id}, 'in_warehouse', ${batteryType.default_cost},
           ${invoiceId}, NOW(), NOW());
      `;

      await sql`
        INSERT INTO battery_movements
          (id, battery_id, from_status, to_status, to_location_id,
           occurred_at, recorded_by_id, notes)
        VALUES
          (${crypto.randomUUID()}, ${batteryId}, NULL, 'in_warehouse',
           ${invoice.location_id}, NOW(), ${session.user.id},
           ${`Received on MBS invoice ${invoiceId}`});
      `;

      const { rows: countRows } = await sql`
        SELECT COUNT(*)::int AS count FROM batteries WHERE mbs_invoice_id = ${invoiceId};
      `;
      const loggedCount = countRows[0].count;

      return NextResponse.json({
        success: true,
        barcode,
        batteryId,
        loggedCount,
      });
    }

    if (action === "finishInvoice") {
      const { invoiceId } = body;
      if (!invoiceId) {
        return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });
      }

      const { rows: invoices } = await sql`
        SELECT battery_count FROM mbs_invoices WHERE id = ${invoiceId};
      `;
      if (invoices.length === 0) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }
      const expected = invoices[0].battery_count;

      const { rows: countRows } = await sql`
        SELECT COUNT(*)::int AS count FROM batteries WHERE mbs_invoice_id = ${invoiceId};
      `;
      const actual = countRows[0].count;

      const newStatus = actual === expected ? "verified" : "discrepancy";
      await sql`
        UPDATE mbs_invoices
        SET status = ${newStatus}, verified_at = NOW(), verified_by_id = ${session.user.id}
        WHERE id = ${invoiceId};
      `;

      return NextResponse.json({
        success: true,
        expected,
        actual,
        discrepancy: expected - actual,
        status: newStatus,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
