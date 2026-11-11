"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Code128 from "@/components/code128";
import {
  DEFAULT_LABEL_SIZE,
  DEMO_LABELS,
  LABEL_SIZES,
  type LabelItem,
  type LabelSizeId,
  PRINT_LABELS_SESSION_KEY,
  type PrintLabelsPayload,
  labelTypography,
  labelsToZpl,
  parseLabelSize,
} from "@/lib/label-print";

function PrintBatteryLabelsInner() {
  const params = useSearchParams();
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [size, setSize] = useState<LabelSizeId>(parseLabelSize(params.get("size") || DEFAULT_LABEL_SIZE));
  const [copies, setCopies] = useState(() => {
    const n = Number(params.get("copies") || 1);
    return Number.isFinite(n) && n >= 1 && n <= 99 ? Math.floor(n) : 1;
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const isDemo = params.get("demo") === "1" || params.get("preview") === "1";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (isDemo) {
          if (!cancelled) {
            setLabels(DEMO_LABELS);
            setLoading(false);
          }
          return;
        }

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
              setError("No labels to print. Open this from Print Labels or Batteries, or add ?demo=1 for a preview.");
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
  const typo = labelTypography(dim);

  function downloadZpl() {
    const zpl = labelsToZpl(labels, size, copies);
    const blob = new Blob([zpl], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `battery-labels-${labels.length}x${copies}-${size}.zpl`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="label-print-root">
      <div className="no-print controls">
        <div>
          <h1>Print battery labels</h1>
          <p>
            One label per barcode, sized to fill the stock and centered. Default is{" "}
            <strong>4&quot; × 3&quot; die-cut</strong> for the Zebra ZD421. Pick a different size
            below if the roll is not 4×3.
          </p>
        </div>
        {isDemo ? (
          <div className="note">
            Preview mode (sample barcode TEST-20261111-0001). This is not a real battery.
          </div>
        ) : null}
        {error ? <div className="err">{error}</div> : null}
        {loading ? <p>Loading labels…</p> : null}
        {!loading && !error ? (
          <p className="meta">
            {labels.length} unique barcode{labels.length === 1 ? "" : "s"}
            {copies > 1 ? ` × ${copies} copies = ${sheet.length} labels` : ""}
            {` · ${dim.wIn} × ${dim.hIn} in`}
          </p>
        ) : null}

        <div className="sizes" role="listbox" aria-label="Label size">
          {Object.values(LABEL_SIZES).map((s) => {
            const selected = s.id === size;
            return (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={selected ? "size-card selected" : "size-card"}
                onClick={() => setSize(s.id)}
                title={s.name}
              >
                <span
                  className="size-thumb"
                  style={{
                    width: `${Math.max(28, s.wIn * 12)}px`,
                    height: `${Math.max(16, s.hIn * 12)}px`,
                  }}
                />
                <span className="size-name">{s.name}</span>
              </button>
            );
          })}
        </div>

        <div className="row">
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

        <details className="howto">
          <summary>Chris&apos;s ZD421 print and calibration settings</summary>
          <ol>
            <li>
              Load the 4&quot; × 3&quot; die-cut roll so the labels feed in the 3&quot; direction
              (4&quot; across the print head).
            </li>
            <li>
              On the printer menu: <strong>Media Type = Gap / Web</strong> (not Continuous),{" "}
              <strong>Print Method = Direct Thermal</strong> if there is no ribbon,{" "}
              <strong>Print Width = 4.00 in</strong> (104 mm, or 812 dots at 203 dpi),{" "}
              <strong>Label Length = 3.00 in</strong> (76 mm, or 609 dots).
            </li>
            <li>
              Run a media calibration: Menu → Tools → <strong>Media / Sensor Calibration</strong>{" "}
              (or hold Pause until it flashes, then Feed, depending on the model). The printer
              should measure the gap and feed a few labels. Tear-off position at 0 unless the
              gap sits off-center.
            </li>
            <li>
              Starting print quality: darkness around <strong>10–12</strong>, speed{" "}
              <strong>4 ips</strong>. Go darker only if the bars look washed out; stay slower if
              they smear.
            </li>
            <li>
              In the Windows Zebra driver: stock 4.00&quot; × 3.00&quot;, media type Labels with
              Gaps, unprintable margins 0, do not use “fit to page.”
            </li>
            <li>
              In the Chrome / Edge print dialog: Destination = Zebra ZD421, paper size{" "}
              <strong>4.00&quot; × 3.00&quot;</strong> (add a custom size if it is missing),
              layout Portrait, scale <strong>100% / Actual size</strong> (never Fit to page),
              margins <strong>None</strong>, headers and footers <strong>off</strong>, Background
              graphics <strong>on</strong>.
            </li>
          </ol>
          <p>
            If you send ZPL instead of the browser dialog, the file already sets{" "}
            <code>^PW812</code> and <code>^LL609</code> for 4×3 at 203 dpi, with gap tracking (
            <code>^MNW</code>) and the barcode centered.
          </p>
        </details>
      </div>

      <div className="sheet" data-size={size}>
        <p className="no-print preview-caption">
          Actual-size preview for {dim.wIn}&quot; × {dim.hIn}&quot; stock. The dashed box is one
          label; print uses the same layout with no margin.
        </p>
        {sheet.map((l) => (
          <div
            key={l.key}
            className="label"
            style={{
              width: `${dim.wIn}in`,
              height: `${dim.hIn}in`,
              padding: `${typo.padIn}in`,
            }}
          >
            <div className="barcode" style={{ height: `${typo.barcodeFrac * 100}%` }}>
              <Code128
                value={l.barcode}
                width={Math.round((dim.wIn - typo.padIn * 2) * 200)}
                height={Math.round(dim.hIn * typo.barcodeFrac * 200)}
              />
            </div>
            <div className="code" style={{ fontSize: `${typo.codeIn}in` }}>
              {l.barcode}
            </div>
            <div className="sub" style={{ fontSize: `${typo.subIn}in` }}>
              {[l.type, l.model].filter(Boolean).join(" · ")}
            </div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        html, body { background: #fff; margin: 0; }
        .label-print-root { min-height: 100vh; }
        .controls { padding: 20px 24px 12px; max-width: 860px; font-family: system-ui, sans-serif; color: #0f172a; }
        .controls h1 { font-size: 22px; margin: 0 0 6px; }
        .controls p { margin: 0 0 12px; color: #475569; font-size: 14px; }
        .controls .meta { font-size: 13px; color: #334155; }
        .controls .err { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; margin-bottom: 12px; font-size: 14px; }
        .controls .note { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 10px 12px; border-radius: 8px; margin-bottom: 12px; font-size: 14px; }
        .controls .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; margin-top: 12px; }
        .controls label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #475569; }
        .controls select, .controls input { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; min-width: 140px; }
        .controls button { padding: 10px 14px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; font-weight: 600; cursor: pointer; }
        .controls button.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
        .controls button:disabled { opacity: 0.5; cursor: not-allowed; }
        .sizes { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 4px; }
        .size-card { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; min-width: 108px; cursor: pointer; font-size: 11px; color: #334155; }
        .size-card.selected { border-color: #2563eb; background: #eff6ff; color: #1e3a8a; box-shadow: 0 0 0 2px #bfdbfe; }
        .size-thumb { display: block; border: 1px solid #64748b; background: #fff; box-sizing: border-box; }
        .size-name { text-align: center; line-height: 1.25; }
        .howto { margin-top: 16px; font-size: 13px; color: #334155; }
        .howto summary { cursor: pointer; font-weight: 600; }
        .howto ol { margin: 8px 0 0; padding-left: 20px; }
        .howto li { margin: 6px 0; }
        .howto code { font-size: 12px; }
        .preview-caption { font-family: system-ui, sans-serif; font-size: 13px; color: #475569; width: 100%; margin: 0 0 8px; }
        .sheet { padding: 16px 24px 32px; display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
        .label {
          box-sizing: border-box;
          border: 1px dashed #cbd5e1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: #fff;
          color: #000;
          text-align: center;
        }
        .barcode { width: 100%; display: flex; justify-content: center; align-items: center; }
        .barcode :global(svg) { width: 100%; height: 100%; display: block; }
        .code { font-family: ui-monospace, Menlo, monospace; letter-spacing: 0.02em; margin-top: 0.06in; word-break: break-all; line-height: 1.15; font-weight: 650; }
        .sub { font-family: system-ui, sans-serif; margin-top: 0.04in; color: #111; font-weight: 600; }
        @media print {
          .no-print { display: none !important; }
          html, body, .label-print-root {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            width: ${dim.wIn}in;
            height: ${dim.hIn}in;
          }
          .sheet { display: block; padding: 0; gap: 0; }
          .label {
            border: none !important;
            margin: 0;
            width: ${dim.wIn}in !important;
            height: ${dim.hIn}in !important;
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
