import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";
import { generateNextBarcode } from "@/lib/barcode";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Every action writes inventory/receipts tied to a location or invoice. We
// resolve the caller via getCurrentUser() (works for both GitHub and manager
// sessions) and, before any write, confirm the target location/invoice/receipt
// belongs to the caller's org. A resource from another org matches nothing.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "owner" && user.role !== "manager") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (!user.orgId) {
    return NextResponse.json({ error: "No organization context" }, { status: 403 });
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

      // Tenant guard: location must belong to the caller's org.
      const { rows: locations } = await sql`
        SELECT l.company_id
        FROM locations l
        JOIN companies c ON c.id = l.company_id
        WHERE l.id = ${locationId} AND c.org_id = ${user.orgId};
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
           'pending_verification', ${user.userId}, NOW());
      `;

      return NextResponse.json({
        success: true,
        invoiceId,
        invoiceNumber,
        expectedCount: batteryCount,
      });
    }

    if (action === "addBattery") {
      const { invoiceId, batteryModelCode } = body;

      if (!invoiceId || !batteryModelCode) {
        return NextResponse.json(
          { error: "Missing required fields: invoiceId, batteryModelCode" },
          { status: 400 }
        );
      }

      // Tenant guard: invoice must belong to the caller's org.
      const { rows: invoices } = await sql`
        SELECT mbs_invoices.id, mbs_invoices.company_id, mbs_invoices.location_id,
               companies.slug AS company_slug
        FROM mbs_invoices
        JOIN companies ON companies.id = mbs_invoices.company_id
        WHERE mbs_invoices.id = ${invoiceId} AND companies.org_id = ${user.orgId};
      `;
      if (invoices.length === 0) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }
      const invoice = invoices[0];

      const { rows: models } = await sql`
        SELECT battery_models.id AS model_id,
               battery_models.default_cost AS model_cost,
               battery_types.id AS type_id,
               battery_types.default_cost AS type_cost
        FROM battery_models
        JOIN battery_types ON battery_types.id = battery_models.battery_type_id
        WHERE battery_models.code = ${batteryModelCode};
      `;
      if (models.length === 0) {
        return NextResponse.json({ error: "Battery model not found" }, { status: 404 });
      }
      const model = models[0];
      const cost = model.model_cost ?? model.type_cost ?? 0;

      const barcode = await generateNextBarcode(invoice.company_slug, batteryModelCode);
      const batteryId = crypto.randomUUID();

      await sql`
        INSERT INTO batteries
          (id, barcode, battery_type_id, battery_model_id, company_id, location_id,
           status, cost, mbs_invoice_id, received_at, created_at)
        VALUES
          (${batteryId}, ${barcode}, ${model.type_id}, ${model.model_id},
           ${invoice.company_id}, ${invoice.location_id}, 'in_warehouse',
           ${cost}, ${invoiceId}, NOW(), NOW());
      `;

      await sql`
        INSERT INTO battery_movements
          (id, battery_id, from_status, to_status, to_location_id,
           occurred_at, recorded_by_id, notes)
        VALUES
          (${crypto.randomUUID()}, ${batteryId}, NULL, 'in_warehouse',
           ${invoice.location_id}, NOW(), ${user.userId},
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

      // Tenant guard: invoice must belong to the caller's org.
      const { rows: invoices } = await sql`
        SELECT mbs_invoices.battery_count
        FROM mbs_invoices
        JOIN companies ON companies.id = mbs_invoices.company_id
        WHERE mbs_invoices.id = ${invoiceId} AND companies.org_id = ${user.orgId};
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
        SET status = ${newStatus}, verified_at = NOW(), verified_by_id = ${user.userId}
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

    // Delivery receipt (day 0) - adds inventory with NO cost

    if (action === "createDeliveryReceipt") {
      const {
        locationId,
        supplier,
        receiptNumber,
        poNumber,
        receiptDate,
        coreCharges,
        coreCredits,
        fileUrl,
        fileName,
        notes,
        totalUnits,
      } = body;

      if (!locationId || !receiptNumber) {
        return NextResponse.json(
          { error: "Missing required fields: locationId, receiptNumber" },
          { status: 400 }
        );
      }

      // Tenant guard: location must belong to the caller's org.
      const { rows: locations } = await sql`
        SELECT l.company_id
        FROM locations l
        JOIN companies c ON c.id = l.company_id
        WHERE l.id = ${locationId} AND c.org_id = ${user.orgId};
      `;
      if (locations.length === 0) {
        return NextResponse.json({ error: "Location not found" }, { status: 404 });
      }
      const companyId = locations[0].company_id;

      const { rows: existing } = await sql`
        SELECT id FROM delivery_receipts
        WHERE receipt_number = ${receiptNumber} AND company_id = ${companyId}
        LIMIT 1;
      `;
      if (existing.length > 0) {
        return NextResponse.json(
          {
            error: `Delivery receipt ${receiptNumber} already exists for this company. It was not added again.`,
            duplicate: true,
            existingId: existing[0].id,
          },
          { status: 409 }
        );
      }

      const charged = Number(coreCharges) || 0;
      const credited = Number(coreCredits) || 0;
      const net = charged - credited;

      const receiptId = crypto.randomUUID();
      const parsedDate = receiptDate ? new Date(receiptDate) : new Date();

      await sql`
        INSERT INTO delivery_receipts
          (id, company_id, location_id, supplier, receipt_number, po_number,
           receipt_date, total_units, core_charges, core_credits, core_net,
           file_url, file_name, notes, uploaded_by_id)
        VALUES
          (${receiptId}, ${companyId}, ${locationId}, ${supplier ?? null},
           ${receiptNumber}, ${poNumber ?? null}, ${parsedDate.toISOString()},
           ${totalUnits ?? null}, ${charged}, ${credited}, ${net},
           ${fileUrl ?? null}, ${fileName ?? null}, ${notes ?? null}, ${user.userId});
      `;

      return NextResponse.json({
        success: true,
        deliveryReceiptId: receiptId,
        receiptNumber,
        coreNet: net,
      });
    }

    if (action === "addBatteryFromDelivery") {
      const { deliveryReceiptId, batteryModelCode, rawDescription } = body;

      if (!deliveryReceiptId || !batteryModelCode) {
        return NextResponse.json(
          { error: "Missing required fields: deliveryReceiptId, batteryModelCode" },
          { status: 400 }
        );
      }

      // Tenant guard: delivery receipt must belong to the caller's org.
      const { rows: receipts } = await sql`
        SELECT delivery_receipts.id, delivery_receipts.company_id, delivery_receipts.location_id,
               companies.slug AS company_slug
        FROM delivery_receipts
        JOIN companies ON companies.id = delivery_receipts.company_id
        WHERE delivery_receipts.id = ${deliveryReceiptId} AND companies.org_id = ${user.orgId};
      `;
      if (receipts.length === 0) {
        return NextResponse.json({ error: "Delivery receipt not found" }, { status: 404 });
      }
      const receipt = receipts[0];

      const { rows: models } = await sql`
        SELECT battery_models.id AS model_id,
               battery_types.id AS type_id
        FROM battery_models
        JOIN battery_types ON battery_types.id = battery_models.battery_type_id
        WHERE battery_models.code = ${batteryModelCode};
      `;
      if (models.length === 0) {
        return NextResponse.json({ error: "Battery model not found" }, { status: 404 });
      }
      const model = models[0];

      const barcode = await generateNextBarcode(receipt.company_slug, batteryModelCode);
      const batteryId = crypto.randomUUID();

      await sql`
        INSERT INTO batteries
          (id, barcode, battery_type_id, battery_model_id, company_id, location_id,
           status, cost, mbs_invoice_id, delivery_receipt_id, received_at, created_at)
        VALUES
          (${batteryId}, ${barcode}, ${model.type_id}, ${model.model_id},
           ${receipt.company_id}, ${receipt.location_id}, 'in_warehouse',
           NULL, NULL, ${deliveryReceiptId}, NOW(), NOW());
      `;

      await sql`
        INSERT INTO battery_movements
          (id, battery_id, from_status, to_status, to_location_id,
           occurred_at, recorded_by_id, notes)
        VALUES
          (${crypto.randomUUID()}, ${batteryId}, NULL, 'in_warehouse',
           ${receipt.location_id}, NOW(), ${user.userId},
           ${`Received on delivery receipt ${deliveryReceiptId}`});
      `;

      await sql`
        INSERT INTO delivery_receipt_lines
          (delivery_receipt_id, raw_description, model_code, units)
        VALUES
          (${deliveryReceiptId}, ${rawDescription ?? null}, ${batteryModelCode}, 1);
      `;

      const { rows: countRows } = await sql`
        SELECT COUNT(*)::int AS count FROM batteries WHERE delivery_receipt_id = ${deliveryReceiptId};
      `;
      const loggedCount = countRows[0].count;

      return NextResponse.json({
        success: true,
        barcode,
        batteryId,
        loggedCount,
      });
    }

    // Warranty pickup (sending warranties back to MBS) - NO inventory change

    if (action === "createWarrantyPickup") {
      const { locationId, supplier, memoNumber, pickupDate, fileUrl, fileName, notes, lines } = body;

      if (!locationId || !memoNumber) {
        return NextResponse.json(
          { error: "Missing required fields: locationId, memoNumber" },
          { status: 400 }
        );
      }

      // Tenant guard: location must belong to the caller's org.
      const { rows: locations } = await sql`
        SELECT l.company_id
        FROM locations l
        JOIN companies c ON c.id = l.company_id
        WHERE l.id = ${locationId} AND c.org_id = ${user.orgId};
      `;
      if (locations.length === 0) {
        return NextResponse.json({ error: "Location not found" }, { status: 404 });
      }
      const companyId = locations[0].company_id;

      // Duplicate guard.
      const { rows: existing } = await sql`
        SELECT id FROM warranty_pickups
        WHERE memo_number = ${memoNumber} AND company_id = ${companyId}
        LIMIT 1;
      `;
      if (existing.length > 0) {
        return NextResponse.json(
          {
            error: `Warranty pickup ${memoNumber} already exists for this company. It was not added again.`,
            duplicate: true,
            existingId: existing[0].id,
          },
          { status: 409 }
        );
      }

      const lineArr: { model_code?: string; raw_description?: string; units: number }[] =
        Array.isArray(lines) ? lines : [];
      const totalUnits = lineArr.reduce((s, l) => s + (Number(l.units) || 0), 0);

      const pickupId = crypto.randomUUID();
      const parsedDate = pickupDate ? new Date(pickupDate) : new Date();

      await sql`
        INSERT INTO warranty_pickups
          (id, company_id, location_id, supplier, memo_number, pickup_date,
           total_units, file_url, file_name, notes, uploaded_by_id)
        VALUES
          (${pickupId}, ${companyId}, ${locationId}, ${supplier ?? null},
           ${memoNumber}, ${parsedDate.toISOString()}, ${totalUnits},
           ${fileUrl ?? null}, ${fileName ?? null}, ${notes ?? null}, ${user.userId});
      `;

      for (const l of lineArr) {
        await sql`
          INSERT INTO warranty_pickup_lines
            (warranty_pickup_id, raw_description, model_code, units)
          VALUES
            (${pickupId}, ${l.raw_description ?? null}, ${l.model_code ?? null}, ${Number(l.units) || 0});
        `;
      }

      return NextResponse.json({
        success: true,
        warrantyPickupId: pickupId,
        memoNumber,
        totalUnits,
      });
    }

    // MBS credit memo (applied against a warranty pickup) - NO inventory change

    if (action === "applyWarrantyCreditMemo") {
      const {
        locationId,
        warrantyPickupId,
        memoNumber,
        memoDate,
        coreCharges,
        coreCredits,
        warrantyCount,
        fileUrl,
        fileName,
        notes,
        lines,
      } = body;

      if (!locationId || !memoNumber) {
        return NextResponse.json(
          { error: "Missing required fields: locationId, memoNumber" },
          { status: 400 }
        );
      }

      // Tenant guard: location must belong to the caller's org.
      const { rows: locations } = await sql`
        SELECT l.company_id
        FROM locations l
        JOIN companies c ON c.id = l.company_id
        WHERE l.id = ${locationId} AND c.org_id = ${user.orgId};
      `;
      if (locations.length === 0) {
        return NextResponse.json({ error: "Location not found" }, { status: 404 });
      }
      const companyId = locations[0].company_id;

      // Duplicate guard.
      const { rows: existing } = await sql`
        SELECT id FROM warranty_credit_memos
        WHERE memo_number = ${memoNumber} AND company_id = ${companyId}
        LIMIT 1;
      `;
      if (existing.length > 0) {
        return NextResponse.json(
          {
            error: `Credit memo ${memoNumber} already exists for this company. It was not added again.`,
            duplicate: true,
            existingId: existing[0].id,
          },
          { status: 409 }
        );
      }

      const charged = Number(coreCharges) || 0;
      const credited = Number(coreCredits) || 0;
      const net = charged - credited;
      const flagged = net > 0;

      const memoId = crypto.randomUUID();
      const parsedDate = memoDate ? new Date(memoDate) : new Date();

      await sql`
        INSERT INTO warranty_credit_memos
          (id, company_id, location_id, warranty_pickup_id, memo_number, memo_date,
           warranty_count, core_charges, core_credits, core_net, flagged,
           file_url, file_name, notes, uploaded_by_id)
        VALUES
          (${memoId}, ${companyId}, ${locationId}, ${warrantyPickupId ?? null},
           ${memoNumber}, ${parsedDate.toISOString()}, ${warrantyCount ?? null},
           ${charged}, ${credited}, ${net}, ${flagged},
           ${fileUrl ?? null}, ${fileName ?? null}, ${notes ?? null}, ${user.userId});
      `;

      const lineArr: { model_code?: string; raw_description?: string; units: number }[] =
        Array.isArray(lines) ? lines : [];
      for (const l of lineArr) {
        await sql`
          INSERT INTO warranty_credit_memo_lines
            (credit_memo_id, raw_description, model_code, units)
          VALUES
            (${memoId}, ${l.raw_description ?? null}, ${l.model_code ?? null}, ${Number(l.units) || 0});
        `;
      }

      return NextResponse.json({
        success: true,
        creditMemoId: memoId,
        memoNumber,
        coreNet: net,
        flagged,
        message: flagged
          ? `FLAG: MBS charged ${net} core(s) on warranties that should net to zero.`
          : "Warranty cores net to zero - no improper core charges.",
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
