import { NextRequest, NextResponse } from "next/server";
import { applyBatteryCatalogUpdates } from "@/lib/battery-catalog";
import { getCurrentUser } from "@/lib/current-user";
import { isPlatformOwner } from "@/lib/demo-leads";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Apply shared battery_models catalog updates. Auth: MIGRATE_SECRET or platform owner.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const okSecret = !!process.env.MIGRATE_SECRET && secret === process.env.MIGRATE_SECRET;
  const user = okSecret ? null : await getCurrentUser();
  if (!okSecret) {
    if (!user || !(await isPlatformOwner(user))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    const result = await applyBatteryCatalogUpdates({
      userId: user?.userId,
      orgId: user?.orgId,
    });
    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
