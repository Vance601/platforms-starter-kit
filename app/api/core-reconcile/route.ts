// app/api/core-reconcile/route.ts
// READ-ONLY per-driver core reconciliation.
// Owner/manager only, scoped to the caller's organization.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getCoreLedger } from "@/lib/core-ledger";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
  }
  if (user.role !== "owner" && user.role !== "manager") {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }
  if (!user.orgId) {
    return NextResponse.json({
      success: true,
      drivers: [],
      totals: { regular_sales: 0, warranties: 0, sold_total: 0, cores_returned: 0, customer_kept: 0, still_owes: 0 },
    });
  }

  try {
    // Shared ledger: cores owed = sold (regular + warranty) - returned - customer kept.
    const ledger = await getCoreLedger(user.orgId);
    const byDriver = new Map<string, Record<string, string | number | null>>();
    for (const r of ledger) {
      const key = r.driver_id ?? "unknown";
      if (!byDriver.has(key)) {
        byDriver.set(key, {
          driver_name: r.driver_name, driver_id: r.driver_id,
          regular_sales: 0, warranties: 0, sold_total: 0,
          cores_returned: 0, customer_kept: 0, still_owes: 0,
        });
      }
      const d = byDriver.get(key)! as Record<string, number>;
      d.sold_total++;
      if (r.is_warranty) d.warranties++; else d.regular_sales++;
      if (r.core_state === "returned") d.cores_returned++;
      else if (r.core_state === "customer_kept") d.customer_kept++;
      else d.still_owes++;
    }
    const rows = Array.from(byDriver.values()).sort(
      (a, b) => Number(b.still_owes) - Number(a.still_owes) ||
        String(a.driver_name).localeCompare(String(b.driver_name))
    );

    const totals = rows.reduce<Record<string, number>>(
      (acc, r) => {
        acc.regular_sales += Number(r.regular_sales) || 0;
        acc.warranties += Number(r.warranties) || 0;
        acc.sold_total += Number(r.sold_total) || 0;
        acc.cores_returned += Number(r.cores_returned) || 0;
        acc.still_owes += Number(r.still_owes) || 0;
        acc.customer_kept += Number(r.customer_kept) || 0;
        return acc;
      },
      { regular_sales: 0, warranties: 0, sold_total: 0, cores_returned: 0, customer_kept: 0, still_owes: 0 }
    );

    return NextResponse.json({ success: true, drivers: rows, totals });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
