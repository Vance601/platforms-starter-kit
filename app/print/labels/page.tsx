"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Code128 from "@/components/code128";
import {
  LABEL_SIZES,
  type LabelItem,
  type LabelSizeId,
  PRINT_LABELS_SESSION_KEY,
  type PrintLabelsPayload,
  labelsToZpl,
  parseLabelSize,
} from "@/lib/label-print";

function PrintBatteryLabelsInner() {
  const params = useSearchParams();
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [size, setSize] = useState<LabelSizeId>(parseLabelSize(params.get("size")));
  const [copies, setCopies] = useState(() => {
    const n = Number(params.get("copies") || 1);
    return Number.isFinite(n) && n >= 1 && n <= 99 ? Math.floor(n) : 1;
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const src = params.get("src") || "";
        const deliveryId = params.get("deliveryId") || params.get("delivery") || "";
        const ids = (params.get("ids") || "").trim();

        if (src === "session" || (!deliveryId && !ids)) {
          try {
            const raw = sessionStorage.getItem(PRINT_LABELS_SESSION_KEY);
            if (raw) {
              const payload = JSON.parse(raw) as PrintLabelsPayload;
              if (!cancelled && Array.isArray(payload.labels) && payload.labels.length) {
                setLabels(payload.labels);
                if (payload.size) setSize(parseLabelSize(payload.size));
                if (payload.copies) setCopies(Math.max(1, Math.min(99, payload.copies)));
                setLoading(false);
                return;
              }
            }
          } catch {
            // ignore bad session payload
          }
          if (!deliveryId && !ids) {
            if (!cancelled) {
              setError("No labels to print. Open this from Print Labels or Batteries.");
              setLoading(false);
            }
            return;
          }
        }

        const q = deliveryId
          ? `deliveryId=${encodeURIComponent(deliveryId)}`
          : `ids=${encodeURIComponent(ids)}`;
        const r = await fetch(`/api/print-labels?${q}`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok || !d.success) {
          throw new Error(d.error || "Could not load labels.");
        }
        const rows: LabelItem[] = (d.batteries || []).map((b: Record<string, string>) => ({
          id: b.id,
          barcode: b.barcode,
          model: b.model_code || b.model || null,
          type: b.type_code || b.classification || b.type || null,
        }));
        if (!cancelled) setLabels(rows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load labels.");
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const sheet = useMemo(() => {
    const n = Math.max(1, Math.min(99, copies));
    return labels.flatMap((l) => Array.from({ length: n }, (_, i) => ({ ...l, key: `${l.id}-${i}` })));
  }, [labels, copies]);

  const dim = LABEL_SIZES[size];

  function downloadZpl() {
    const zpl = labelsToZpl(labels, size, copies);
    const blob = new Blob([zpl], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `battery-labels-${labels.length}x${copies}.zpl`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="label-print-root">
      <div className="no-print controls">
        <div>
          <h1>Print battery labels</h1>
          <p>
            One label per barcode for a Zebra ZD421 (or any thermal printer). Use these printer
            settings: paper size matching the dropdown, scale 100% / Actual size, margins None,
            headers and footers off.
          </p>
        </div>
        {error ? <div className="err">{error}</div> : null}
        {loading ? <p>Loading labels…</p> : null}
        {!loading && !error ? (
          <p className="meta">
            {labels.length} unique barcode{labels.length === 1 ? "" : "s"}
            {copies > 1 ? ` × ${copies} copies = ${sheet.length} labels` : ""}
          </p>
        ) : null}
        <div className="row">
          <label>
            Label size
            <select value={size} onChange={(e) => setSize(parseLabelSize(e.target.value))}>
              {Object.values(LABEL_SIZES).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Copies
            <input
              type="number"
              min={1}
              max={99}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
            />
          </label>
          <button type="button" className="primary" disabled={!sheet.length} onClick={() => window.print()}>
            Print {sheet.length || ""} label{sheet.length === 1 ? "" : "s"}
          </button>
          <button type="button" disabled={!labels.length} onClick={downloadZpl}>
            Download ZPL
          </button>
        </div>
      </div>

      <div className="sheet" data-size={size}>
        {sheet.map((l) => (
          <div
            key={l.key}
            className="label"
            style={{ width: `${dim.wIn}in`, height: `${dim.hIn}in` }}
          >
            <div className="barcode">
              <Code128 value={l.barcode} width={Math.round(dim.wIn * 160)} height={Math.round(dim.hIn * 48)} />
            </div>
            <div className="code">{l.barcode}</div>
            <div className="sub">
              {[l.type, l.model].filter(Boolean).join(" · ")}
            </div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        html, body { background: #fff; margin: 0; }
        .label-print-root { min-height: 100vh; }
        .controls { padding: 20px 24px 12px; max-width: 720px; font-family: system-ui, sans-serif; color: #0f172a; }
        .controls h1 { font-size: 22px; margin: 0 0 6px; }
        .controls p { margin: 0 0 12px; color: #475569; font-size: 14px; }
        .controls .meta { font-size: 13px; color: #334155; }
        .controls .err { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; margin-bottom: 12px; font-size: 14px; }
        .controls .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; }
        .controls label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #475569; }
        .controls select, .controls input { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; min-width: 140px; }
        .controls button { padding: 10px 14px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; font-weight: 600; cursor: pointer; }
        .controls button.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
        .controls button:disabled { opacity: 0.5; cursor: not-allowed; }
        .sheet { padding: 16px 24px 32px; display: flex; flex-wrap: wrap; gap: 12px; }
        .label {
          box-sizing: border-box;
          border: 1px dashed #cbd5e1;
          padding: 0.06in 0.08in 0.04in;
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow: hidden;
          background: #fff;
          color: #000;
        }
        .barcode { width: 100%; display: flex; justify-content: center; }
        .barcode :global(svg) { width: 100%; height: auto; max-height: 55%; display: block; }
        .code { font-family: ui-monospace, Menlo, monospace; font-size: 9px; letter-spacing: 0.02em; text-align: center; margin-top: 3px; word-break: break-all; line-height: 1.15; }
        .sub { font-family: system-ui, sans-serif; font-size: 8px; text-align: center; color: #222; margin-top: 1px; }
        @media print {
          .no-print { display: none !important; }
          html, body, .label-print-root { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          .sheet { display: block; padding: 0; gap: 0; }
          .label {
            border: none !important;
            margin: 0;
            page-break-after: always;
            break-after: page;
            box-shadow: none;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .label:last-child { page-break-after: auto; break-after: auto; }
          @page { size: ${dim.wIn}in ${dim.hIn}in; margin: 0; }
        }
      `}</style>
    </div>
  );
}

export default function PrintBatteryLabelsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, fontFamily: "system-ui" }}>Loading labels…</div>}>
      <PrintBatteryLabelsInner />
    </Suspense>
  );
}
