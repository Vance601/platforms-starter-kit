"use client";

import { useState, useEffect } from "react";

type OutstandingRow = {
  driver_name: string;
  model_code: string;
  cores_owed: number;
};

type Summary = {
  owed: number;
  returned: number;
  customer_kept: number;
  other: number;
  total: number;
};

type ReportResponse = {
  outstanding: OutstandingRow[];
  summary: Summary;
  error?: string;
};

type LocationOpt = { company_id: string; location_id: string };
type OwedRow = {
  company_id: string;
  location_id: string;
  model_code: string;
  owed: number;
};
type FormData = {
  success: boolean;
  error?: string;
  locations?: LocationOpt[];
  owedByModel?: OwedRow[];
};

type ClearResult = {
  modelCode: string;
  requested: number;
  cleared: number;
  shortfall: number;
};

const STOCK_CODES = [
  "124R","140R","151R","24F","27","34","35","47","47AGM","48","48AGM",
  "49","49AGM","51","51R","65","78","86","94RAGM","96R","AUX14","PRIUS","TESLA",
];

export default function CoreAccountabilityPage() {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [report, setReport] = useState<ReportResponse | null>(null);
  const [form, setForm] = useState<FormData | null>(null);

  // Invoice form state
  const [companyId, setCompanyId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [lines, setLines] = useState<{ modelCode: string; qty: string }[]>([
    { modelCode: "", qty: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);
  const [clearWarnings, setClearWarnings] = useState<string[]>([]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      // Report
      const repRes = await fetch("/api/core-accountability", { cache: "no-store" });
      const repJson: ReportResponse = await repRes.json();

      // Form data (cores owed by model, locations)
      const formRes = await fetch("/api/core-returns", { cache: "no-store" });
      const formJson: FormData = await formRes.json();

      if (!formJson.success) {
        setError(formJson.error || "Could not load.");
        return;
      }

      setReport(repJson);
      setForm(formJson);

      // Auto-select the only location if there's just one.
      const locs = formJson.locations || [];
      if (locs.length === 1) {
        setCompanyId(locs[0].company_id);
        setLocationId(locs[0].location_id);
      }
      setLoaded(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function setLine(i: number, key: "modelCode" | "qty", val: string) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [key]: val } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { modelCode: "", qty: "" }]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  // How many are owed for a given model at the selected location (for the warning hint).
  function owedFor(modelCode: string): number | null {
    if (!form?.owedByModel || !companyId || !locationId) return null;
    const row = form.owedByModel.find(
      (r) =>
        r.company_id === companyId &&
        r.location_id === locationId &&
        r.model_code === modelCode
    );
    return row ? row.owed : 0;
  }

  async function submitInvoice() {
    setClearMsg(null);
    setClearWarnings([]);
    setError(null);

    if (!companyId || !locationId) {
      setError("Pick a company/location first.");
      return;
    }
    const cleanLines = lines
      .map((l) => ({ modelCode: l.modelCode.trim(), qty: parseInt(l.qty, 10) }))
      .filter((l) => l.modelCode && Number.isFinite(l.qty) && l.qty > 0);
    if (cleanLines.length === 0) {
      setError("Add at least one model with a quantity.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/core-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, locationId, lines: cleanLines }),
      });
      const json: {
        success: boolean;
        error?: string;
        totalCleared?: number;
        results?: ClearResult[];
        warnings?: string[];
      } = await res.json();

      if (!json.success) {
        setError(json.error || "Could not clear cores.");
        return;
      }

      setClearMsg(`Cleared ${json.totalCleared ?? 0} core(s).`);
      setClearWarnings(json.warnings || []);
      setLines([{ modelCode: "", qty: "" }]);
      await loadAll(); // refresh report + owed counts
    } catch {
      setError("Network error while clearing. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Initial loading state (replaces the old password gate).
  if (!loaded) {
    return (
      <div className="max-w-md space-y-4 py-6">
        <h1 className="text-2xl font-bold">Core Accountability</h1>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              onClick={loadAll}
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white"
            >
              Retry
            </button>
          </>
        )}
      </div>
    );
  }

  const locations = form?.locations || [];

  return (
    <div className="mx-auto max-w-4xl py-2">
      <h1 className="text-2xl font-bold text-gray-900">Core Accountability</h1>
      <p className="mt-1 text-sm text-gray-500">
        Every sale owes a core back to the warehouse. Record an MBS invoice to clear
        returned cores. Customer-kept cores are not counted as missing.
      </p>

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Summary */}
      {report && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Summary</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card label="Owed" value={report.summary.owed} accent="text-red-600" hint="Not turned in" />
            <Card label="Returned" value={report.summary.returned} accent="text-green-600" hint="Sent to MBS" />
            <Card label="Customer kept" value={report.summary.customer_kept} accent="text-gray-600" hint="No core exists" />
            <Card label="Total" value={report.summary.total} accent="text-gray-900" hint="All records" />
          </div>
        </section>
      )}

      {/* Outstanding by driver */}
      {report && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-gray-900">Outstanding by Driver</h2>
          <p className="mt-1 text-sm text-gray-500">
            Cores owed to the warehouse, grouped by driver and battery model.
          </p>
          {report.outstanding.length === 0 ? (
            <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
              No outstanding cores. Everyone is squared up.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-md border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-2 font-medium">Driver</th>
                    <th className="px-4 py-2 font-medium">Model</th>
                    <th className="px-4 py-2 text-right font-medium">Cores owed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.outstanding.map((row, i) => (
                    <tr key={`${row.driver_name}-${row.model_code}-${i}`}>
                      <td className="px-4 py-2 text-gray-900">{row.driver_name}</td>
                      <td className="px-4 py-2 text-gray-700">{row.model_code}</td>
                      <td className="px-4 py-2 text-right font-semibold text-red-600">{row.cores_owed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Enter MBS Core Invoice */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900">Enter MBS Core Invoice</h2>
        <p className="mt-1 text-sm text-gray-500">
          Record cores returned to MBS. Each line clears the oldest owed cores of that
          model. Use one invoice per company/location.
        </p>

        {clearMsg ? (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {clearMsg}
          </div>
        ) : null}
        {clearWarnings.length > 0 ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="font-medium">Heads up - invoice exceeded owed cores:</p>
            <ul className="mt-1 list-disc pl-5">
              {clearWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 space-y-4 rounded-md border border-gray-200 p-4">
          {/* Location picker */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
              Company / Location
            </label>
            {locations.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500">
                No locations with owed cores yet.
              </p>
            ) : locations.length === 1 ? (
              <p className="mt-1 text-sm text-gray-700">
                {companyId.slice(0, 8)}… / {locationId.slice(0, 8)}… (only location)
              </p>
            ) : (
              <select
                value={`${companyId}::${locationId}`}
                onChange={(e) => {
                  const [c, l] = e.target.value.split("::");
                  setCompanyId(c);
                  setLocationId(l);
                }}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              >
                <option value="::">Select…</option>
                {locations.map((loc) => (
                  <option
                    key={`${loc.company_id}::${loc.location_id}`}
                    value={`${loc.company_id}::${loc.location_id}`}
                  >
                    {loc.company_id.slice(0, 8)}… / {loc.location_id.slice(0, 8)}…
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Lines */}
          <div className="space-y-2">
            {lines.map((line, i) => {
              const owed = line.modelCode ? owedFor(line.modelCode) : null;
              return (
                <div key={i} className="flex items-center gap-2">
                  <input
                    list="model-codes"
                    value={line.modelCode}
                    onChange={(e) => setLine(i, "modelCode", e.target.value)}
                    placeholder="Model (e.g. 35)"
                    className="w-40 rounded border px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={line.qty}
                    onChange={(e) => setLine(i, "qty", e.target.value)}
                    placeholder="Qty"
                    className="w-24 rounded border px-3 py-2 text-sm"
                  />
                  {owed !== null ? (
                    <span className="text-xs text-gray-400">{owed} owed</span>
                  ) : null}
                  <button
                    onClick={() => removeLine(i)}
                    className="ml-auto rounded px-2 py-1 text-xs text-gray-400 hover:text-red-600"
                    title="Remove line"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
            <datalist id="model-codes">
              {STOCK_CODES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <button
              onClick={addLine}
              className="rounded border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              + Add line
            </button>
          </div>

          <button
            onClick={submitInvoice}
            disabled={submitting || locations.length === 0}
            className={
              "rounded-lg px-4 py-2 text-sm font-medium " +
              (submitting || locations.length === 0
                ? "cursor-not-allowed bg-slate-200 text-slate-400"
                : "bg-blue-600 text-white")
            }
          >
            {submitting ? "Clearing…" : "Clear cores"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Card({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: number;
  accent: string;
  hint: string;
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent}`}>{value}</div>
      <div className="mt-1 text-xs text-gray-400">{hint}</div>
    </div>
  );
}
