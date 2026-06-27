"use client";

import { useState, useEffect } from "react";

type Warranty = {
  id: string;
  barcode: string;
  received_at: string | null;
  sold_on_call_number: string | null;
  cost: string | null;
  status: string;
  core_returned: boolean;
};

type ReportData = {
  success: boolean;
  error?: string;
  warranties?: Warranty[];
  totalOwed?: string;
};

// Format an ISO date as YYYY-MM-DD (the original purchase date for the MBS report).
function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toISOString().split("T")[0];
}

export default function WarrantyReportPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function loadReport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/warranty-report`, {
        cache: "no-store",
      });
      const json: ReportData = await res.json();
      if (!json.success) {
        setError(json.error || "Could not load report.");
        return;
      }
      setWarranties(json.warranties || []);
      setLoaded(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Load automatically on mount — the API authenticates via your session.
  useEffect(() => {
    loadReport();
  }, []);

  // Save one warranty's wholesale cost to the DB.
  async function saveCost(batteryId: string, costValue: string) {
    setSavingId(batteryId);
    setError(null);
    try {
      const res = await fetch(`/api/warranty-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batteryId, cost: costValue }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Could not save cost.");
        return;
      }
      // Reflect the saved (server-normalized) cost in local state.
      setWarranties((prev) =>
        prev.map((w) =>
          w.id === batteryId ? { ...w, cost: String(json.cost) } : w
        )
      );
    } catch {
      setError("Network error while saving. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  // Local edit of a cost field (before save).
  function editCost(batteryId: string, value: string) {
    setWarranties((prev) =>
      prev.map((w) => (w.id === batteryId ? { ...w, cost: value } : w))
    );
  }

  // Running total MBS owes = sum of entered costs.
  const totalOwed = warranties.reduce((sum, w) => {
    const n = parseFloat(w.cost || "0");
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  // Build and download a CSV for MBS: purchase date, call number, wholesale cost.
  function exportCSV() {
    if (warranties.length === 0) return;
    const header = "Original Purchase Date,Towbook Call Number,Wholesale Cost\n";
    const rows = warranties
      .map((w) => {
        const date = fmtDate(w.received_at);
        const call = (w.sold_on_call_number || "").replace(/,/g, ";");
        const cost = parseFloat(w.cost || "0");
        return `${date},${call},${(isNaN(cost) ? 0 : cost).toFixed(2)}`;
      })
      .join("\n");
    const totalLine = `\nTOTAL,,${totalOwed.toFixed(2)}`;
    const blob = new Blob([header + rows + totalLine], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().split("T")[0];
    link.href = url;
    link.setAttribute("download", `mbs-warranty-claim-${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Initial loading state (replaces the old password gate).
  if (!loaded) {
    return (
      <div className="max-w-md space-y-4 py-6">
        <h1 className="text-2xl font-bold">Warranty Report — MBS Claims</h1>
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

  return (
    <div className="space-y-6 py-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Warranty Report — MBS Claims</h1>
        <div className="flex gap-2">
          <button
            onClick={loadReport}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            Refresh
          </button>
          <button
            onClick={exportCSV}
            disabled={warranties.length === 0}
            className={
              "rounded-md px-3 py-1.5 text-sm font-medium " +
              (warranties.length === 0
                ? "cursor-not-allowed bg-slate-200 text-slate-400"
                : "bg-blue-600 text-white")
            }
          >
            Export for MBS
          </button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Every warranty replacement is a claim against MBS for the wholesale cost you paid.
        Enter the wholesale cost for each, then export to send MBS.
      </p>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Total owed */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border px-4 py-3 text-center">
          <p className="text-2xl font-bold">{warranties.length}</p>
          <p className="text-xs text-muted-foreground">Warranty Claims</p>
        </div>
        <div className="rounded-lg border px-4 py-3 text-center">
          <p className="text-2xl font-bold">${totalOwed.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">Total Owed by MBS</p>
        </div>
      </div>

      {warranties.length === 0 ? (
        <div className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">
          No warranty replacements on record.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-3 py-2">Original Purchase Date</th>
                <th className="px-3 py-2">Towbook Call #</th>
                <th className="px-3 py-2">Battery</th>
                <th className="px-3 py-2">Core Returned</th>
                <th className="px-3 py-2">Wholesale Cost</th>
              </tr>
            </thead>
            <tbody>
              {warranties.map((w) => (
                <tr key={w.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{fmtDate(w.received_at)}</td>
                  <td className="px-3 py-2">{w.sold_on_call_number || "-"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{w.barcode}</td>
                  <td className="px-3 py-2">
                    {w.core_returned ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Returned
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={w.cost ?? ""}
                        onChange={(e) => editCost(w.id, e.target.value)}
                        onBlur={(e) => saveCost(w.id, e.target.value)}
                        className="w-28 rounded border px-2 py-1 text-sm"
                      />
                      {savingId === w.id ? (
                        <span className="text-xs text-muted-foreground">saving…</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
