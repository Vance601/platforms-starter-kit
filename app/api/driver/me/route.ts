import { NextRequest, NextResponse } from "next/server";
import { getDriverContext } from "@/lib/driver-session";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const ctx = await getDriverContext(req);
  if (!ctx) {
    return NextResponse.json({ success: false, error: "Not signed in. Please log in again." }, { status: 401 });
  }
  return NextResponse.json({
    success: true,
    driver: {
      id: ctx.driverId,
      name: ctx.name,
      company_id: ctx.companyId,
      isWarehouse: ctx.isWarehouse,
    },
    claimedTruckId: ctx.truckId,
    isWarehouse: ctx.isWarehouse,
  });
}
