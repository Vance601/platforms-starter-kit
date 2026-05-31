"use client";

import { useState } from "react";

type DriverRow = {
  driver_name: string;
  driver_id: string;
  regular_sales: number;
  warranties: number;
  sold_total: number;
  cores_owed: number;
  cores_returned: number;
};

type Totals = {
  regular_sales: number;
  warranties: number;
  sold_total: number;
  cores_owed: number;
  cores_returned: number;
};

type ApiResponse = {
  success: boolean;
  error?: string;
  drivers?: DriverRow[];
  totals?: Totals;
};

export default function CoreReconcilePage() {
  const [pw, setPw] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);

  async function load() {
    if (!pw.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/core-reconcile?pw=${encodeURIComponent(pw.trim())}`,
        { cache: "no-store" }
      );
      const json: ApiResponse = await res.json();
      if (!json.success) {
        setError(json.error || "Could not load reconciliation.");
        return;
      }
      setDrivers(json.drivers || []);
      setTotals(json.totals || null);
      setLoaded(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ---- Password gate ----
  if (!loaded) {
    return (
      <div className="max-w-md space-y-4 py-6">
        <h1 className="text-2xl font-bold">Driver Core Reconciliation</h1>
        <p className="text-sm text-gray-500">
          Owner access required. Enter the admin password to view per-driver core
          accountability.
        </p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") load();
          }}
          placeholder="Admin password"
          className="w-full rounded-lg border px-4 py-3"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          onClick={load}
          disabled={!pw.trim() || loading}
          className={
            "rounded-lg px-4 py-2 font-medium " +
            (!pw.trim() || loading
              ? "cursor-not-allowed bg-slate-200 text-slate-400"
              : "bg-blue-600 text-white")
          }
        >
          {loading ? "Loading…" : "View"}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl py-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Driver Core Reconciliation</h1>
        <button onClick={load} className="rounded-md border px-3 py-1.5 text-sm">
          Refresh
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Every battery a driver sells — regular or warranty — owes one core back to the
        warehouse. The <span className="font-medium">Still Owes</span> column is the live
        gap: cores he hasn&apos;t turned in yet.
      </p>

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Totals */}
      {totals && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Card label="Regular sales" value={totals.regular_sales} accent="text-gray-900" />
          <Card label="Warranties" value={totals.warranties} accent="text-gray-900" />
          <Card label="Total sold" value={totals.sold_total} accent="text-gray-900" />
          <Card label="Cores turned in" value={totals.cores_returned} accent="text-green-600" />
          <Card label="Still owed" value={totals.cores_owed} accent="text-red-600" />
        </div>
      )}

      {/* Per-driver table */}
      <div className="mt-8 overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-2 font-medium">Driver</th>
              <th className="px-4 py-2 text-right font-medium">Sales</th>
              <th className="px-4 py-2 text-right font-medium">Warranties</th>
              <th className="px-4 py-2 text-right font-medium">Total sold</th>
              <th className="px-4 py-2 text-right font-medium">Turned in</th>
              <th className="px-4 py-2 text-right font-medium">Still owes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {drivers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  No driver-attributed sales yet. Once drivers record sales, they appear here.
                </td>
              </tr>
            ) : (
              drivers.map((d) => (
                <tr key={d.driver_id} className={d.cores_owed > 0 ? "bg-red-50/40" : ""}>
                  <td className="px-4 py-2 font-medium text-gray-900">{d.driver_name}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{d.regular_sales}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{d.warranties}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{d.sold_total}</td>
                  <td className="px-4 py-2 text-right font-medium text-green-600">{d.cores_returned}</td>
                  <td
                    className={
                      "px-4 py-2 text-right font-bold " +
                      (d.cores_owed > 0 ? "text-red-600" : "text-gray-400")
                    }
                  >
                    {d.cores_owed}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Note: only sales recorded after the driver-capture fix carry attribution. Earlier
        unattributed sales won&apos;t appear against a driver.
      </p>
    </div>
  );
}

function Card({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}
