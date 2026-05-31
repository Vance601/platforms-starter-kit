import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Verify the session cookie set by auth-driver login.
function verifySession(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [driverId, expiryStr, sig] = parts;
  const secret = process.env.MIGRATE_SECRET || "";
  const expected = crypto.scryptSync(`${driverId}.${expiryStr}`, secret, 32).toString("hex");
  if (sig !== expected) return null;
  if (Date.now() > Number(expiryStr)) return null;
  return driverId;
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("driver_session")?.value;
    const driverId = verifySession(token);
    if (!driverId) {
      return NextResponse.json(
        { success: false, error: "Not signed in. Please log in again." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const batteryId: string | undefined = body?.batteryId;
    const callNumberRaw: string | undefined = body?.callNumber;
    const callNumber = (callNumberRaw || "").trim();

    // Warranty fields (all optional — only present on a warranty sale).
    const isWarranty: boolean = body?.isWarranty === true;
    const replacesBatteryIdRaw: string | undefined = body?.replacesBatteryId;
    const replacesBatteryId = (replacesBatteryIdRaw || "").trim() || null;
    const warrantyNoteRaw: string | undefined = body?.warrantyNote;
    const warranty
