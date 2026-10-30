import { NextRequest, NextResponse } from "next/server";
import { getDriverContext } from "@/lib/driver-session";
import { normalizeVin, vinError } from "@/lib/vin";
import { askClaudeJson } from "@/lib/anthropic";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

// Fallback when the VIN barcode won't scan: read the VIN from a photo with the
// same Claude vision model the invoice reader uses. Nothing is stored.
export async function POST(req: NextRequest) {
  try {
    const ctx = await getDriverContext(req);
    if (!ctx) return NextResponse.json({ success: false, error: "Not signed in. Please log in again." }, { status: 401 });
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ success: false, error: "Photo reading isn't configured. Type the VIN instead." }, { status: 503 });
    }
    const body = await req.json().catch(() => ({}));
    const data = typeof body?.imageBase64 === "string" ? body.imageBase64 : "";
    const mediaType = ["image/jpeg", "image/png", "image/webp"].includes(body?.mediaType) ? body.mediaType : "";
    if (!data || !mediaType) return NextResponse.json({ success: false, error: "No photo received." }, { status: 400 });
    if (data.length > 6_000_000) return NextResponse.json({ success: false, error: "Photo is too large." }, { status: 413 });

    const out = await askClaudeJson([
      { type: "image", source: { type: "base64", media_type: mediaType, data } },
      { type: "text", text: 'This photo shows a vehicle VIN (windshield plate, door-jamb sticker or registration). Read the 17-character VIN exactly. VINs never contain I, O or Q. Reply with JSON only: {"vin": "<17 chars or empty if unreadable>"}' },
    ], 100);
    const vin = normalizeVin(typeof out?.vin === "string" ? out.vin : "");
    if (!vin) return NextResponse.json({ success: false, error: "Couldn't read a VIN in that photo. Try closer, or type it." }, { status: 422 });
    const bad = vinError(vin);
    return NextResponse.json({ success: true, vin, valid: !bad, warning: bad });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
