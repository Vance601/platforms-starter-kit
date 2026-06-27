"use client";

import { useState, useEffect } from "react";

type Battery = {
  id: string;
  barcode: string;
  status: string;
  cost: string | null;
  sold_on_call_number: string | null;
  sold_at: string | null;
  is_warranty: boolean;
  warranty_replaces_battery_id: string | null;
  warranty_note: string | null;
  on_truck_number: string | null;
  replaces_barcode: string | null;
};

type StatusCount = { status: string; count: number };
type RedFlag = { id: string; barcode: string; status: string };
type AgingBattery = {
  id: string;
  barcode: string;
  truck_number: string | null;
  loaded_by: string | null;
  current_holder: string | null;
  loaded_at: string | null;
  days_on_truck: number | null;
};
type Revenue = {
  paid_sales: number;
  warranty_replacements: number;
  paid_revenue: string;
};
type CoreAccountability = {
  owed: number;
  returned: number;
  outstanding: number;
};

type ReconcileData = {
  success: boolean;
  error?: string;
  statusCounts?: StatusCount[];
  batteries?: Battery[];
  redFlags?: RedFlag[];
  agingOnTruck?: AgingBattery[];
  revenue?: Revenue;
  coreAccountability?: CoreAccountability;
};

const STATUS_LABELS: Record<string, string> = {
  in_warehouse: "In Warehouse",
  on_truck: "On Truck",
  sold: "Sold",
  returned_core: "Returned Core",
  missing: "Missing",
  damaged: "Damaged",
};

function statusColor(status: string): string {
  switch (status) {
    case "in_warehouse":
      return "bg-slate-100 text-slate-700";
    case "on_truck":
      return "bg-blue-100 text-blue-700";
    case "sold":
      return "bg-green-100 text-green-700";
    case "missing":
      return "bg-red-100 text-red-700";
    case "damaged":
      return "bg-amber-100 text-amber-700";
    case "returned_core":
      return "bg-purple-100 text-purple-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

// Aging thresholds: red at 14+ days on a truck with no sale, yellow at 7-13.
function agingTier(days: number | null): "red" | "yellow" | "green" {
  if (days === null) return "yellow"; // unknown load date - worth a look
  if (days >= 14) return "red";
  if (days >= 7) return "yellow";
  return "green";
}

function agingRowColor(tier: "red" | "yellow" | "green"): string {
  switch (tier) {
    case "red":
      return "bg-red-50";
    case "yellow":
      return "bg-amber-50";
    default:
      return "";
  }
}

function agingBadge(tier: "red" | "yellow" | "green"): string {
  switch (tier) {
    case "red":
      return "bg-red-100 text-red-700";
    case "yellow":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-green-100 text-green-700";
  }
}

export default function ReconcilePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReconcileData | null>(null);

  async function loadReport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reconcile`, {
        cache: "no-store",
      });
      const json: ReconcileData = await res.json();
      if (!json.success) {
        setError(json.error || "Could not load report.");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
  }, []);

  // Initial loading state (replaces the old password gate).
  if (!data) {
    return (
      <div className="max-w-md space-y-4 py-6">
        <h1 className="text-2xl font-bold">Battery Reconciliation</h1>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              onClick={loadReport}
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white"
            >
              Retry
            </button>
          </>
        )}
      </div>
    );
  }

  const counts = data.statusCounts || [];
  const batteries = data.batteries || [];
  const redFlags = data.redFlags || [];
  const aging = data.agingOnTruck || [];
  const revenue = data.revenue;
  const coreAcct = data.coreAccountability;

  // How many aging units are in the red (14+ days)?
  const agingRed = aging.filter((a) => agingTier(a.days_on_truck) === "red").length;

  return (
    <div className="space-y-6 py-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Battery Reconciliation</h1>
        <button
          onClick={loadReport}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Red flag banner */}
      {redFlags.length > 0 ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3">
          <p className="font-semibold text-red-700">
            {redFlags.length} batter{redFlags.length === 1 ? "y" : "ies"} unaccounted (missing)
          </p>
          <ul className="mt-1 text-sm text-red-600">
            {redFlags.map((f) => (
              <li key={f.id} className="font-mono">{f.barcode}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3">
          <p className="font-semibold text-green-700">
            All batteries accounted for - no missing units.
          </p>
        </div>
      )}

      {/* Status summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {counts.map((c) => (
          <div key={c.status} className="rounded-lg border px-4 py-3 text-center">
            <p className="text-2xl font-bold">{c.count}</p>
            <p className="text-xs text-muted-foreground">
              {STATUS_LABELS[c.status] || c.status}
            </p>
          </div>
        ))}
      </div>

      {/* Revenue snapshot */}
      {revenue ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border px-4 py-3 text-center">
            <p className="text-xl font-bold">{revenue.paid_sales}</p>
            <p className="text-xs text-muted-foreground">Paid Sales</p>
          </div>
          <div className="rounded-lg border px-4 py-3 text-center">
            <p className="text-xl font-bold">{revenue.warranty_replacements}</p>
            <p className="text-xs text-muted-foreground">Warranties (free)</p>
          </div>
          <div className="rounded-lg border px-4 py-3 text-center">
            <p className="text-xl font-bold">${revenue.paid_revenue}</p>
            <p className="text-xs text-muted-foreground">Paid Revenue</p>
          </div>
        </div>
      ) : null}

      {/* Core accountability - cores owed to MBS vs returned. Outstanding = money still owed back. */}
      {coreAcct ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Core Accountability - MBS</h2>
            {coreAcct.outstanding > 0 ? (
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                {coreAcct.outstanding} core{coreAcct.outstanding === 1 ? "" : "s"} not returned
              </span>
            ) : (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                All cores returned
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Each battery bought from MBS carries one core charge. Return the dead core to get credited. Outstanding cores are money still owed back to you.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border px-4 py-3 text-center">
              <p className="text-xl font-bold">{coreAcct.owed}</p>
              <p className="text-xs text-muted-foreground">Cores Owed to MBS</p>
            </div>
            <div className="rounded-lg border px-4 py-3 text-center">
              <p className="text-xl font-bold">{coreAcct.returned}</p>
              <p className="text-xs text-muted-foreground">Cores Returned</p>
            </div>
            <div
              className={
                "rounded-lg border px-4 py-3 text-center " +
                (coreAcct.outstanding > 0 ? "border-red-300 bg-red-50" : "")
              }
            >
              <p
                className={
                  "text-xl font-bold " +
                  (coreAcct.outstanding > 0 ? "text-red-700" : "")
                }
              >
                {coreAcct.outstanding}
              </p>
              <p className="text-xs text-muted-foreground">Outstanding</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Aging inventory - batteries on trucks, accountability by driver */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Aging Inventory - Batteries On Trucks</h2>
          {agingRed > 0 ? (
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
              {agingRed} over 14 days
            </span>
          ) : (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              None overdue
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Batteries loaded onto a truck but not yet sold or returned. Red = 14+ days (follow up with the driver).
        </p>
        {aging.length === 0 ? (
          <div className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">
            No batteries currently on trucks.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-3 py-2">Barcode</th>
                  <th className="px-3 py-2">Truck</th>
                  <th className="px-3 py-2">Driver (loaded by)</th>
                  <th className="px-3 py-2">Truck held by</th>
                  <th className="px-3 py-2">Days on truck</th>
                </tr>
              </thead>
              <tbody>
                {aging.map((a) => {
                  const tier = agingTier(a.days_on_truck);
                  return (
                    <tr key={a.id} className={"border-b last:border-0 " + agingRowColor(tier)}>
                      <td className="px-3 py-2 font-mono">{a.barcode}</td>
                      <td className="px-3 py-2">
                        {a.truck_number ? `#${a.truck_number}` : "-"}
                      </td>
                      <td className="px-3 py-2">{a.loaded_by || "-"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{a.current_holder || "-"}</td>
                      <td className="px-3 py-2">
                        <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + agingBadge(tier)}>
                          {a.days_on_truck === null ? "unknown" : `${a.days_on_truck} day${a.days_on_truck === 1 ? "" : "s"}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full battery list */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-3 py-2">Barcode</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Location / Call</th>
              <th className="px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {batteries.map((b) => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono">{b.barcode}</td>
                <td className="px-3 py-2">
                  <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + statusColor(b.status)}>
                    {STATUS_LABELS[b.status] || b.status}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {b.status === "on_truck" && b.on_truck_number
                    ? `Truck #${b.on_truck_number}`
                    : b.status === "sold" && b.sold_on_call_number
                    ? `Call #${b.sold_on_call_number}`
                    : "-"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {b.is_warranty
                    ? b.replaces_barcode
                      ? `Warranty - replaces ${b.replaces_barcode}`
                      : `Warranty - ${b.warranty_note || "not in system"}`
                    : b.status === "sold"
                    ? `$${b.cost ?? "0.00"}`
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
