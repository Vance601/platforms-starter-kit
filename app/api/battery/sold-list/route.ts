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

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("driver_session")?.value;
    const driverId = verifySession(token);
    if (!driverId) {
      return NextResponse.json(
        { success: false, error: "Not signed in. Please log in again." },
        { status: 401 }
      );
    }

    // Driver's company — the failed-battery list is scoped company-wide.
    const { rows: driverRows } = await sql`
      SELECT id, company_id
      FROM drivers
      WHERE id = ${driverId};
    `;
    if (driverRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Driver not found." },
        { status: 404 }
      );
    }
    const driver = driverRows[0];

    // All sold batteries for this company — these are the candidates a warranty can replace.
    const { rows: soldBatteries } = await sql`
      SELECT id, barcode, sold_on_call_number, sold_at
      FROM batteries
      WHERE status = 'sold'
        AND company_id = ${driver.company_id}
      ORDER BY sold_at DESC NULLS LAST
      LIMIT 200;
    `;

    return NextResponse.json({
      success: true,
      soldBatteries,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
