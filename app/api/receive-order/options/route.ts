import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Reads an uploaded MBS invoice (image or PDF) with Claude vision and returns
// structured line items, mapping MBS product codes (e.g. S24F-Express) to this
// system's battery_models.code values (e.g. 24F). Reads valid codes from the DB
// so the model can only map to real values. Nothing is written here — the user
// reviews and confirms before any inventory is committed.
export async function POST(req: NextRequest) {
  try {
    // Accept BOTH auth paths: the GitHub/NextAuth session (owner) and the
    // manager_session cookie (staff). Calling auth() directly only saw GitHub
    // sessions, so a signed-in manager could not scan an invoice.
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Scan is not configured (missing API key)." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const fileBase64 = typeof body.fileBase64 === "string" ? body.fileBase64 : "";
    const mediaType = typeof body.mediaType === "string" ? body.mediaType : "";

    if (!fileBase64 || !mediaType) {
      return NextResponse.json({ success: false, error: "No file provided." }, { status: 400 });
    }

    // Valid model codes so the AI maps to real values only.
    const { rows: modelRows } = await sql`SELECT code FROM battery_models ORDER BY code;`;
    const validCodes = modelRows.map((r) => r.code as string);

    const isPdf = mediaType === "application/pdf";
    const sourceBlock = isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: fileBase64 } };

    const prompt = `You are reading an MBS Solutions (Wrench Inc) battery invoice. Extract the data and return ONLY a JSON object — no prose, no markdown fences.

These are the valid battery model codes in our system:
${validCodes.join(", ")}

MBS invoice line items use product codes that wrap our model code, with a prefix that indicates chemistry:
- Prefix "MX-" or "MX" generally means AGM chemistry → map to the AGM version of the code (e.g. "MX-H6/L3/48-Express" → "48AGM", "MX-H5/L2/47-Express" → "47AGM").
- Prefix "S-" or "S" generally means standard chemistry → map to the non-AGM code (e.g. "S-H6/L3/48-Express" → "48", "S24F-Express" → "24F").
- "L1/H4/140R" style → strip wrapping, map to the core code ("140R").
- "M14AUX" → "AUX14". "SX124R" → "124R". "MX51JIS" → "51".
- Lines containing "Core" (e.g. "Core-BSI") are CORE CHARGES, not batteries — put these in "coreLines", not "lineItems".

Return exactly:
{
  "invoiceNumber": "string or empty",
  "poNumber": "string or empty",
  "invoiceDate": "YYYY-MM-DD or empty",
  "totalAmount": number or 0,
  "lineItems": [
    { "mbsCode": "the raw code from the invoice", "mappedCode": "one of our valid codes, or UNKNOWN", "quantity": number, "agm": true/false, "confident": true/false }
  ],
  "coreLines": [
    { "description": "string", "quantity": number }
  ]
}

Set "confident" to false for any line where the chemistry (AGM vs standard) or the code mapping is ambiguous. Be precise with quantities. If unsure of a value, use empty string or 0 rather than guessing.`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [{ role: "user", content: [sourceBlock, { type: "text", text: prompt }] }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text().catch(() => "");
      return NextResponse.json(
        { success: false, error: `Reader error: ${anthropicRes.status} ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await anthropicRes.json();
    const textOut = Array.isArray(data?.content)
      ? data.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("")
      : "";

    let parsed: any;
    try {
      const clean = textOut.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      return NextResponse.json(
        { success: false, error: "Could not read the invoice clearly. Try a sharper image, or enter manually." },
        { status: 422 }
      );
    }

    const validSet = new Set(validCodes.map((c) => c.toUpperCase()));
    const lineItems = Array.isArray(parsed.lineItems)
      ? parsed.lineItems
          .map((li: any) => {
            const mapped = typeof li.mappedCode === "string" ? li.mappedCode.trim().toUpperCase() : "";
            return {
              mbsCode: typeof li.mbsCode === "string" ? li.mbsCode.trim() : "",
              mappedCode: validSet.has(mapped) ? mapped : (mapped || "UNKNOWN"),
              quantity: Number(li.quantity) || 0,
              agm: Boolean(li.agm),
              confident: li.confident !== false && validSet.has(mapped),
            };
          })
          .filter((li: any) => li.quantity > 0)
      : [];

    const coreLines = Array.isArray(parsed.coreLines)
      ? parsed.coreLines
          .map((cl: any) => ({
            description: typeof cl.description === "string" ? cl.description.trim() : "Core",
            quantity: Number(cl.quantity) || 0,
          }))
          .filter((cl: any) => cl.quantity > 0)
      : [];

    return NextResponse.json({
      success: true,
      invoiceNumber: typeof parsed.invoiceNumber === "string" ? parsed.invoiceNumber : "",
      poNumber: typeof parsed.poNumber === "string" ? parsed.poNumber : "",
      invoiceDate: typeof parsed.invoiceDate === "string" ? parsed.invoiceDate : "",
      totalAmount: Number(parsed.totalAmount) || 0,
      lineItems,
      coreLines,
      validCodes,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
