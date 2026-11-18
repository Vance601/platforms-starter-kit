"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DEFAULT_LABEL_DPI,
  DEFAULT_LABEL_SIZE,
  DEMO_LABELS,
  LABEL_DPI_STORAGE_KEY,
  LABEL_SIZE_STORAGE_KEY,
  LABEL_SIZES,
  type LabelDpi,
  type LabelItem,
  type LabelSizeId,
  PRINT_LABELS_SESSION_KEY,
  type PrintLabelsPayload,
  labelDots,
  labelPrintCss,
  labelSvg,
  labelsToZpl,
  parseLabelDpi,
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
  const [dpi, setDpi] = useState<LabelDpi>(() => parseLabelDpi(params.get("dpi")) || DEFAULT_LABEL_DPI);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const isDemo = params.get("demo") === "1" || params.get("preview") === "1";

  useEffect(() => {
    try {
      if (!params.get("dpi")) {
        const savedDpi = localStorage.getItem(LABEL_DPI_STORAGE_KEY);
        if (savedDpi) setDpi(parseLabelDpi(savedDpi));
      }
      if (!params.get("size")) {
        const savedSize = localStorage.getItem(LABEL_SIZE_STORAGE_KEY);
        if (savedSize) setSize(parseLabelSize(savedSize));
      }
    } catch {
      // ignore missing localStorage
    }
  }, [params]);

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
          date: b.label_date || b.received_at || b.created_at || null,
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
  const dots = labelDots(dim, dpi);

  function changeDpi(next: LabelDpi) {
    setDpi(next);
    try {
      localStorage.setItem(LABEL_DPI_STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
  }

  function changeSize(next: LabelSizeId) {
    setSize(next);
    try {
      localStorage.setItem(LABEL_SIZE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  function downloadZpl() {
    const zpl = labelsToZpl(labels, size, copies, dpi);
    const blob = new Blob([zpl], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `battery-labels-${labels.length}x${copies}-${size}-${dpi}dpi.zpl`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="label-print-root">
      <div className="no-print controls">
        <div>
          <h1>Print battery labels</h1>
          <p>
            One label per battery. Default stock is the <strong>3&quot; × 2&quot; die-cut</strong> roll in the Zebra
            ZD421. A large QR (the scan target) sits on the left; the date, battery size, and ID sit on the right. A
            Code 128 goes underneath only when it fits. The Duggers printer is the <strong>300 dpi</strong> model; pick
            203 only if the printer name says 203 dpi.
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
            {` · ${dim.wIn} × ${dim.hIn} in · ${dpi} dpi (${dots.W} × ${dots.H} dots)`}
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
                onClick={() => changeSize(s.id)}
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
          <label>
            Printer resolution
            <select value={dpi} onChange={(e) => changeDpi(parseLabelDpi(e.target.value))}>
              <option value={300}>300 dpi (ZD421-300dpi, Duggers)</option>
              <option value={203}>203 dpi (ZD421-203dpi)</option>
            </select>
          </label>
          <button type="button" className="primary" disabled={!labels.length} onClick={downloadZpl}>
            Download ZPL (recommended)
          </button>
          <button type="button" disabled={!sheet.length} onClick={() => window.print()}>
            Print {sheet.length || ""} label{sheet.length === 1 ? "" : "s"} from browser
          </button>
        </div>

        <div className="howto open-howto">
          <strong>Recommended: send ZPL straight to the printer.</strong>
          <p>
            Browser print has to go through Chrome and the Windows driver, which is what printed the wrong size last
            time. The ZPL file already sets the exact size (
            <code>
              ^PW{dots.W} ^LL{dots.H}
            </code>{" "}
            for {dim.wIn}&quot; × {dim.hIn}&quot; at {dpi} dpi), the gap sensor, the QR, the date, and the barcode when
            it fits. Use <strong>Download ZPL</strong>, then:
          </p>
          <ol>
            <li>Open <strong>Zebra Setup Utilities</strong> → select the ZD421 → <strong>Open Communication With Printer</strong>.</li>
            <li>Click <strong>Open file</strong>, pick the downloaded <code>.zpl</code>, then <strong>Send to printer</strong>.</li>
            <li>
              Or from Command Prompt:{" "}
              <code>copy /b battery-labels.zpl &quot;\\%COMPUTERNAME%\ZDesigner ZD421-300dpi&quot;</code> (the printer
              must be shared under that name).
            </li>
          </ol>
          <strong>If you do print from Chrome, set the driver stock first — do not use “Custom.”</strong>
          <ol>
            <li>
              Load the {dim.wIn}&quot; × {dim.hIn}&quot; die-cut roll so {dim.wIn}&quot; is across the print head and
              the labels feed in the {dim.hIn}&quot; direction.
            </li>
            <li>
              In Windows: right-click <strong>ZDesigner ZD421-300dpi</strong> → <strong>Printing Preferences</strong> →{" "}
              <strong>Page Setup</strong> → <strong>Stock: New</strong> → name it <strong>{size}</strong>, size{" "}
              <strong>{dim.wIn.toFixed(2)} × {dim.hIn.toFixed(2)} in</strong>
              {size === "3x2" ? " (76 × 51 mm)" : ""}, orientation <strong>Portrait</strong>. Save. Pick that stock
              (not Custom). Media type: Labels with Gaps. Unprintable margins: 0. Do not use “fit to page.”
            </li>
            <li>
              On the printer menu: <strong>Media Type = Gap / Web</strong> (not Continuous),{" "}
              <strong>Print Method = Direct Thermal</strong> if there is no ribbon,{" "}
              <strong>Print Width = {dim.wIn.toFixed(2)} in</strong> ({dots.W} dots at {dpi} dpi),{" "}
              <strong>Label Length = {dim.hIn.toFixed(2)} in</strong> ({dots.H} dots). Run a media calibration (Menu →
              Tools → Media / Sensor Calibration) after changing stock.
            </li>
            <li>
              In the Chrome print dialog: Destination = <strong>ZDesigner ZD421-300dpi</strong>, paper size = the{" "}
              <strong>{size}</strong> stock you created (or 3×2 / 76×51 mm; never “Custom”), layout Portrait, pages per
              sheet 1, margins <strong>None</strong>, scale <strong>Default / 100</strong> or <strong>Actual size</strong>{" "}
              (never Fit to page), headers and footers off, Background graphics on. It should say{" "}
              <strong>1 sheet of paper</strong> for one label. If it says 2 or more, cancel and use Download ZPL
              instead.
            </li>
            <li>
              Starting print quality: darkness around <strong>10–12</strong>, speed <strong>4 ips</strong>.
            </li>
          </ol>
        </div>
      </div>

      <div className="sheet" data-size={size} data-dpi={dpi}>
        <p className="no-print preview-caption">
          Actual-size preview for {dim.wIn}&quot; × {dim.hIn}&quot; stock at {dpi} dpi. The dashed box is one label;
          print uses the same layout with no margin, and each label is exactly one page.
        </p>
        {sheet.map((l) => {
          const { svg } = labelSvg(l, size, dpi);
          return (
            <div
              key={l.key}
              className="label"
              style={{
                width: `${dim.wIn}in`,
                height: `${dim.hIn}in`,
              }}
            >
              <div
                className="label-art"
                style={{ width: `${dim.wIn}in`, height: `${dim.hIn}in` }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
          );
        })}
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
        .howto { margin-top: 16px; font-size: 13px; color: #334155; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; }
        .howto p { margin: 8px 0 10px; color: #334155; }
        .howto ol { margin: 8px 0 12px; padding-left: 20px; }
        .howto li { margin: 6px 0; }
        .howto code { font-size: 12px; }
        .preview-caption { font-family: system-ui, sans-serif; font-size: 13px; color: #475569; width: 100%; margin: 0 0 8px; }
        .sheet { padding: 16px 24px 32px; display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
        .label {
          box-sizing: border-box;
          border: 1px dashed #cbd5e1;
          overflow: hidden;
          background: #fff;
          color: #000;
          text-align: center;
        }
        .label-art, .label-art svg {
          display: block;
          width: 100%;
          height: 100%;
          max-width: 100%;
          max-height: 100%;
          image-rendering: pixelated;
          image-rendering: crisp-edges;
          shape-rendering: crispEdges;
        }
      `}</style>
      <style
        // Unscoped so @page is honored by Chrome. styled-jsx has dropped @page in the past.
        dangerouslySetInnerHTML={{ __html: labelPrintCss(dim) }}
      />
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
