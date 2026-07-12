"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Delivery = {
  id: string;
  supplier: string | null;
  receipt_number: string | null;
  po_number: string | null;
  receipt_date: string | null;
  total_units: number | null;
  battery_count: number;
};

type BatteryLabel = {
  id: string;
  barcode: string;
  model_code: string;
};

function fmtDate(d: string | null): string {
  if (!d) return "no date";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function PrintLabelsPage() {
  const [loading, setLoading] = useState(true);
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
                {(d.supplier || "Unknown supplier")} - {fmtDate(d.receipt_date)}
                {d.receipt_number ? ` - #${d.receipt_number}` : ""} - {d.battery_count} batteries
              </option>
            ))}
          </select>
        </div>

        {labels.length > 0 ? (
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              Print {labels.length} labels
            </button>
            <span className="text-sm text-gray-500">
              Set your printer to the 2&quot; x 1&quot; label size, margins off.
            </span>
          </div>
        ) : null}

        {labelsLoading ? <p className="mt-4 text-sm text-gray-500">Loading batteries...</p> : null}
        {!labelsLoading && selectedId && labels.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No batteries found in this delivery.</p>
        ) : null}
      </div>

      <div className="labels-sheet mt-6">
        {labels.map((b) => (
          <div key={b.id} className="label">
            <QRCodeSVG value={b.barcode} size={64} level="M" />
            <div className="label-text">
              <div className="label-code">{b.barcode}</div>
              {b.model_code ? <div className="label-model">Model {b.model_code}</div> : null}
            </div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        .labels-sheet {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .label {
          width: 2in;
          height: 1in;
          border: 1px solid #ddd;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 6px;
          box-sizing: border-box;
          overflow: hidden;
        }
        .label-text {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
        }
        .label-code {
          font-family: monospace;
          font-size: 8.5px;
          line-height: 1.1;
          word-break: break-all;
        }
        .label-model {
          font-size: 8px;
          color: #444;
          margin-top: 2px;
        }
        @media print {
          .label {
            border: none;
            page-break-after: always;
            break-after: page;
            width: 2in;
            height: 1in;
            margin: 0;
          }
          .labels-sheet {
            display: block;
            gap: 0;
          }
          @page {
            size: 2in 1in;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
