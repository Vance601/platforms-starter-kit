"use client";

import { useState } from "react";

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
type Revenue = {
  paid_sales: number;
  warranty_replacements: number;
  paid_revenue: string;
};

type ReconcileData = {
  success: boolean;
  error?: string;
  statusCounts?: StatusCount[];
  batteries?: Battery[];
  redFlags?: RedFlag[];
  revenue?: Revenue;
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

export default function ReconcilePage() {
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReconcileData | null>(null);

  async function loadReport() {
    if (!pw.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reconcile?pw=${encodeURIComponent(pw.trim())}`, {
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

  // Password gate
  if (!data) {
    return (
      <div className="max-w-md space-y-4 py-6">
        <h1 className="text-2xl font-bold">Battery Reconciliation</h1>
        <p className="text-sm text-muted-foreground">
          Owner access required. Enter the admin password to view the report.
        </p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") loadReport();
          }}
          placeholder="Admin password"
          className="w-full rounded-lg border px-4 py-3"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          onClick={loadReport}
          disabled={!pw.trim() || loading}
          className={
            "rounded-lg px-4 py-2 font-medium " +
            (!pw.trim() || loading
              ? "cursor-not-allowed bg-slate-200 text-slate-400"
              : "bg-blue-600 text-white")
          }
        >
          {loading ? "Loading…" : "View Report"}
        </button>
      </div>
    );
  }

  const counts = data.statusCounts || [];
  const batteries = data.batteries || [];
  const redFlags = data.redFlags || [];
  const revenue = data.revenue;

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
            ⚠️ {redFlags.length} batter{redFlags.length === 1 ? "y" : "ies"} unaccounted (missing)
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
            ✓ All batteries accounted for — no missing units.
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
                    : "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {b.is_warranty
                    ? b.replaces_barcode
                      ? `Warranty — replaces ${b.replaces_barcode}`
                      : `Warranty — ${b.warranty_note || "not in system"}`
                    : b.status === "sold"
                    ? `$${b.cost ?? "0.00"}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
