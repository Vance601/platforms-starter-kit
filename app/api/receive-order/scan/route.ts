import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Reads an uploaded MBS invoice image with Claude vision and returns structured
// line items. It first loads the valid battery_types codes from the DB so the
// model can only return types this system recognizes. Nothing is written to
// inventory here — this route only proposes; the user reviews and confirms.
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
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
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
    const mediaType = typeof body.mediaType === "string" ? body.mediaType : "";

    if (!imageBase64 || !mediaType) {
      return NextResponse.json(
        { success: false, error: "No image provided." },
        { status: 400 }
      );
    }

    // Load valid battery type codes so the model maps to real values.
    const { rows: typeRows } = await sql`SELECT code FROM battery_types ORDER BY code;`;
    const validCodes = typeRows.map((r) => r.code as string);

    const isPdf = mediaType === "application/pdf";
    const sourceBlock = isPdf
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: imageBase64 },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: imageBase64 },
        };

    const prompt = `You are reading an MBS Solutions battery invoice. Extract the data and return ONLY a JSON object, no other text, no markdown fences.

The valid battery type codes are: ${validCodes.join(", ")}. Map each line item's battery to ONE of these exact codes. If a battery clearly doesn't match any, use "UNKNOWN".

Return this exact JSON shape:
{
  "invoiceNumber": "string or empty",
  "invoiceDate": "YYYY-MM-DD or empty",
  "totalAmount": number or 0,
  "lineItems": [
    { "type": "one of the valid codes", "quantity": number, "reference": "any P.O. or name reference on that line, or empty" }
  ]
}

Be precise with quantities and the total. If unsure about a value, use empty string or 0 rather than guessing.`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [sourceBlock, { type: "text", text: prompt }],
          },
        ],
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

    // Normalize and keep only line items with a valid known type and positive qty.
    const lineItems = Array.isArray(parsed.lineItems)
      ? parsed.lineItems
          .map((li: any) => ({
            type: typeof li.type === "string" ? li.type.trim().toUpperCase() : "",
            quantity: Number(li.quantity) || 0,
            reference: typeof li.reference === "string" ? li.reference.trim() : "",
          }))
          .filter((li: any) => li.quantity > 0)
      : [];

    return NextResponse.json({
      success: true,
      invoiceNumber: typeof parsed.invoiceNumber === "string" ? parsed.invoiceNumber : "",
      invoiceDate: typeof parsed.invoiceDate === "string" ? parsed.invoiceDate : "",
      totalAmount: Number(parsed.totalAmount) || 0,
      lineItems,
      validCodes,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
