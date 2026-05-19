import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { rows: batteries } = await sql`
      SELECT
        batteries.id,
        batteries.barcode,
        batteries.status,
        batteries.cost,
        batteries.received_at,
        battery_types.code AS type_code,
        locations.id AS location_id,
        locations.name AS location_name,
        companies.name AS company_name,
        mbs_invoices.invoice_number AS source_invoice
      FROM batteries
      JOIN battery_types ON battery_types.id = batteries.battery_type_id
      JOIN locations ON locations.id = batteries.location_id
      JOIN companies ON companies.id = batteries.company_id
      JOIN user_companies ON user_companies.company_id = companies.id
      LEFT JOIN mbs_invoices ON mbs_invoices.id = batteries.mbs_invoice_id
      WHERE user_companies.user_id = ${session.user.id}
      ORDER BY batteries.received_at DESC;
    `;

    return NextResponse.json({
      batteries: batteries.map(b => ({
        id: b.id,
        barcode: b.barcode,
        type: b.type_code,
        status: b.status,
        cost: b.cost,
        receivedAt: b.received_at,
        locationId: b.location_id,
        locationName: b.location_name,
        companyName: b.company_name,
        sourceInvoice: b.source_invoice,
      })),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
