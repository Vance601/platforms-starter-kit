import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type LineItem = {
  raw_description?: string;
  model_code?: string;
  units: number;
};

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
    }
    const userId = session.user.id;

    const form = await req.formData();
    const kind = String(form.get("kind") || "");
    if (kind !== "delivery" && kind !== "warranty") {
      return NextResponse.json(
        { success: false, error: "kind must be 'delivery' or 'warranty'." },
        { status: 400 }
      );
    }

    // Common header fields
    const company_id     = (form.get("company_id") as string) || null;
    const location_id    = (form.get("location_id") as string) || null;
    const supplier       = (form.get("supplier") as string) || null;
    const mbs_invoice_id = (form.get("mbs_invoice_id") as string) || null;
    const dateStr        = (form.get("date") as string) || null; // YYYY-MM-DD
    const notes          = (form.get("notes") as string) || null;

    // Parse line items (JSON string in the "lines" field)
    let lines: LineItem[] = [];
    const linesRaw = form.get("lines") as string | null;
    if (linesRaw) {
      try {
        const parsed = JSON.parse(linesRaw);
        if (Array.isArray(parsed)) lines = parsed;
      } catch {
        return NextResponse.json({ success: false, error: "lines is not valid JSON." }, { status: 400 });
      }
    }

    // Upload the file to Vercel Blob (optional — a doc may be added without lines, or vice versa)
    let file_url: string | null = null;
    let file_name: string | null = null;
    const file = form.get("file") as File | null;
    if (file && typeof file === "object" && file.size > 0) {
      file_name = file.name || `${kind}-${Date.now()}`;
      const blob = await put(
        `receive/${kind}/${Date.now()}-${file_name}`,
        file,
        { access: "public", addRandomSuffix: true }
      );
      file_url = blob.url;
    }

    const totalUnits = lines.reduce((s, l) => s + (Number(l.units) || 0), 0);

    if (kind === "delivery") {
      const receipt_number = (form.get("receipt_number") as string) || null;
      const po_number      = (form.get("po_number") as string) || null;
      const core_charges   = form.get("core_charges") ? Number(form.get("core_charges")) : null;

      const { rows } = await sql`
        INSERT INTO delivery_receipts
          (company_id, location_id, supplier, receipt_number, po_number, receipt_date,
           mbs_invoice_id, total_units, core_charges, file_url, file_name, notes, uploaded_by_id)
        VALUES
          (${company_id}, ${location_id}, ${supplier}, ${receipt_number}, ${po_number}, ${dateStr},
           ${mbs_invoice_id}, ${totalUnits}, ${core_charges}, ${file_url}, ${file_name}, ${notes}, ${userId})
        RETURNING id;
      `;
      const receiptId = rows[0].id as string;

      for (const l of lines) {
        await sql`
          INSERT INTO delivery_receipt_lines
            (delivery_receipt_id, raw_description, model_code, units)
          VALUES
            (${receiptId}, ${l.raw_description ?? null}, ${l.model_code ?? null}, ${Number(l.units) || 0});
        `;
      }

      return NextResponse.json({ success: true, id: receiptId, kind, totalUnits, file_url });
    } else {
      // warranty
      const memo_number = (form.get("memo_number") as string) || null;

      const { rows } = await sql`
        INSERT INTO warranty_pickups
          (company_id, location_id, supplier, memo_number, pickup_date,
           mbs_invoice_id, total_units, file_url, file_name, notes, uploaded_by_id)
        VALUES
          (${company_id}, ${location_id}, ${supplier}, ${memo_number}, ${dateStr},
           ${mbs_invoice_id}, ${totalUnits}, ${file_url}, ${file_name}, ${notes}, ${userId})
        RETURNING id;
      `;
      const pickupId = rows[0].id as string;

      for (const l of lines) {
        await sql`
          INSERT INTO warranty_pickup_lines
            (warranty_pickup_id, raw_description, model_code, units)
          VALUES
            (${pickupId}, ${l.raw_description ?? null}, ${l.model_code ?? null}, ${Number(l.units) || 0});
        `;
      }

      return NextResponse.json({ success: true, id: pickupId, kind, totalUnits, file_url });
    }
  } catch (err: unknown) {
    console.error("receive/upload error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}
