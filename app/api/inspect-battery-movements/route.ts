import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.MIGRATE_SECRET) {
    return NextResponse.json(
      { error: "Unauthorized. Add ?secret=YOUR_MIGRATE_SECRET to the URL." },
      { status: 401 }
    );
  }

  try {
    // Full column list for battery_movements
    const { rows: movementCols } = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'battery_movements'
      ORDER BY ordinal_position;
    `;

    // Full column list for batteries
    const { rows: batteryCols } = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'batteries'
      ORDER BY ordinal_position;
    `;

    // A few sample battery rows so I can see real status/company values
    const { rows: sampleBatteries } = await sql`
      SELECT id, company_id, truck_id, status
      FROM batteries
      LIMIT 5;
    `;

    return NextResponse.json({
      success: true,
      battery_movements_columns: movementCols,
      batteries_columns: batteryCols,
      sample_batteries: sampleBatteries,
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
