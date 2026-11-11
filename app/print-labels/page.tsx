"use client";

import { useEffect, useState } from "react";
import { useOrgSettings } from "@/lib/use-org-settings";

type Delivery = {
  id: string;
  supplier: string | null;
  receipt_number?: string | null;
  po_number?: string | null;
  receipt_date?: string | null;
  // /api/print-labels returns these names (batch_date / reference).
  batch_date?: string | null;
  reference?: string | null;
  total_units: number | null;
  battery_count: number;
};

type BatteryLabel = {
  id: string;
  barcode: string;
  model_code: string;
};

function fmtDate(d: string | null, timeZone: string): string {
  if (!d) return "no date";
  // DATE columns arrive as "YYYY-MM-DD" or midnight-UTC ISO; render the
  // calendar day as-is so a US timezone doesn't shift it back a day.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (m) {
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone });
}

export default function PrintLabelsPage() {
  const [loading, setLoading] = useState(true);
  const { timezone } = useOrgSettings();
  const [error, setError] = useState<string | null>(null);

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [labels, setLabels] = useState<BatteryLabel[]>([]);
  const [labelsLoading, setLabelsLoading] = useState(false);

  async function loadDeliveries() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/print-labels", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Could not load deliveries.");
        return;
      }
      setDeliveries(json.deliveries || []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeliveries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLabels(deliveryId: string) {
    setSelectedId(deliveryId);
    setLabels([]);
    if (!deliveryId) return;
    setLabelsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/print-labels?deliveryId=${encodeURIComponent(deliveryId)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Could not load batteries.");
        return;
      }
      setLabels(json.batteries || []);
    } catch {
      setError("Network error loading batteries.");
    } finally {
      setLabelsLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-md space-y-4 py-6">
        <h1 className="text-2xl font-bold">Print Battery Labels</h1>
        <p className="text-sm text-gray-500">Loading deliveries...</p>
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="print:hidden mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900">Print Battery Labels</h1>
        <p className="mt-1 text-sm text-gray-500">
          Pick a delivery, then print QR labels (2&quot; x 1&quot;) for every battery in it.
        </p>

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
            Delivery
          </label>
          <select
            value={selectedId}
            onChange={(e) => loadLabels(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          >
            <option value="">Select a delivery...</option>
            {deliveries.map((d) => (
              <option key={d.id} value={d.id}>
                {(d.supplier || "Unknown supplier")} - {fmtDate(d.batch_date ?? d.receipt_date ?? null, timezone)}
                {(d.reference ?? d.receipt_number) ? ` - #${d.reference ?? d.receipt_number}` : ""} - {d.battery_count} batteries
              </option>
            ))}
          </select>
        </div>

        {labels.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={`/print/labels?deliveryId=${encodeURIComponent(selectedId)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              Print {labels.length} labels
            </a>
            <span className="text-sm text-gray-500">
              Opens a print view: one Code 128 label per barcode, sized for a Zebra ZD421.
              Default 2&quot; × 1&quot;, scale 100%, margins none.
            </span>
          </div>
        ) : null}

        {labels.length > 0 ? (
          <p className="mt-3 text-sm text-gray-600">
            {labels.length} batter{labels.length === 1 ? "y" : "ies"} in this delivery will print.
          </p>
        ) : null}

        {labelsLoading ? <p className="mt-4 text-sm text-gray-500">Loading batteries...</p> : null}
        {!labelsLoading && selectedId && labels.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No batteries found in this delivery.</p>
        ) : null}
      </div>

    </div>
  );
}
