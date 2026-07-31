import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { put } from "@vercel/blob";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type LineItem = {
  raw_description?: string;
  model_code?: string;
  units: number;
};

export async function POST(req: Request) {
  try {
    // Accept BOTH auth paths. getCurrentUser resolves the GitHub/NextAuth
    // session (owner) and the manager_session cookie (staff). The previous
    // version called auth() directly, which only saw GitHub sessions, so a
    // signed-in manager was rejected with "Unauthorized" and could not
    // receive stock at all.
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
    const userId = user.userId;

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

    // TENANT BOUNDARY. company_id and location_id are supplied by the browser,
    // so they must be proven to belong to the caller's organization before any
    // insert. Without this, a signed-in user of one org could write stock into
    // another org's company. Mirrors the check in /api/locations/add.
    if (company_id) {
      const { rows: okCompany } = await sql`
        SELECT id FROM companies
        WHERE id = ${company_id} AND org_id = ${user.orgId}
        LIMIT 1;
      `;
      if (okCompany.length === 0) {
        return NextResponse.json(
          { success: false, error: "That company was not found." },
          { status: 403 }
        );
      }
    }
    if (location_id) {
      const { rows: okLocation } = await sql`
        SELECT l.id FROM locations l
        JOIN companies c ON c.id = l.company_id
        WHERE l.id = ${location_id} AND c.org_id = ${user.orgId}
        LIMIT 1;
      `;
      if (okLocation.length === 0) {
        return NextResponse.json(
          { success: false, error: "That location was not found." },
          { status: 403 }
        );
      }
    }
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
