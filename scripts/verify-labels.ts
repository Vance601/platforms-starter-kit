import { mkdirSync, writeFileSync } from "fs";
import {
  DEMO_LABELS,
  DEFAULT_LABEL_DPI,
  DEFAULT_LABEL_SIZE,
  LABEL_SIZES,
  type LabelItem,
  type LabelDpi,
  type LabelSizeId,
  formatLabelDate,
  labelPrintCss,
  labelSvg,
  labelsToZpl,
  rasterLabel,
  rasterToPbm,
} from "../lib/label-print";

const samples: LabelItem[] = [
  DEMO_LABELS[0],
  { id: "scan-sample", barcode: "DG-PHX-78-20261116-0001", type: "78", model: "Bravo", date: "2026-11-16" },
  { id: "chris-sample", barcode: "DG-PHX-31xxD-20261118-0001", type: "AGM", model: "31xxD", date: "2026-11-18" },
];

const outDir = process.env.LABEL_VERIFY_DIR || "/tmp/label-verify";
mkdirSync(outDir, { recursive: true });

const sizeId: LabelSizeId = DEFAULT_LABEL_SIZE;

function safeName(barcode: string, dpi: number, size: string) {
  return `${barcode.replace(/[^A-Za-z0-9_-]+/g, "_")}-${size}-${dpi}dpi`;
}

function writeBundle(item: LabelItem, dpi: LabelDpi, size: LabelSizeId = sizeId) {
  const { width, height, mono, layout } = rasterLabel(item, size, dpi);
  const safe = safeName(item.barcode, dpi, size);
  const pbmPath = `${outDir}/${safe}.pbm`;
  writeFileSync(pbmPath, rasterToPbm(width, height, mono));
  const { svg } = labelSvg(item, size, dpi);
  writeFileSync(`${outDir}/${safe}.svg`, svg);
  const dim = LABEL_SIZES[size];
  const bounds = {
    qr: { x: layout.qr.x, y: layout.qr.y, size: layout.qr.size },
    code128: layout.code128
      ? { x: layout.code128.x, y: layout.code128.y, w: layout.code128.width, h: layout.code128.height }
      : null,
    lines: layout.lines.map((l) => ({ text: l.text, x: l.x, y: l.y, fontH: l.fontH })),
    pad: layout.pad,
    W: layout.W,
    H: layout.H,
    date: layout.date,
  };
  console.log(
    JSON.stringify({
      barcode: item.barcode,
      date: formatLabelDate(item.date, item.barcode),
      pbm: pbmPath,
      width,
      height,
      dpi,
      inches: `${dim.wIn}x${dim.hIn}`,
      qrCell: layout.qr.cell,
      qrSize: layout.qr.size,
      qrX: layout.qr.x,
      qrY: layout.qr.y,
      code128Module: layout.code128?.module ?? null,
      code128QuietPx: layout.code128?.quietPx ?? null,
      code128Width: layout.code128?.width ?? null,
      text: layout.lines.map((l) => l.text),
      pad: layout.pad,
    }),
  );
  return { svg, width, height, layout, bounds };
}

for (const dpi of [300, 203] as LabelDpi[]) {
  for (const item of samples) writeBundle(item, dpi);
}

writeFileSync(`${outDir}/sample-300dpi.zpl`, labelsToZpl(samples, sizeId, 1, 300));
writeFileSync(`${outDir}/sample-203dpi.zpl`, labelsToZpl(samples, sizeId, 1, 203));
console.log("zpl", `${outDir}/sample-300dpi.zpl`, `${outDir}/sample-203dpi.zpl`);

const dim = LABEL_SIZES[sizeId];
const css = `
  html, body { margin: 0; padding: 0; background: #fff; }
  .sheet { padding: 0; margin: 0; }
  .label { box-sizing: border-box; overflow: hidden; background: #fff; }
  .label-art, .label-art svg { display: block; width: 100%; height: 100%; }
  ${labelPrintCss(dim)}
`;

function printHtml(items: LabelItem[], dpi: LabelDpi) {
  const labels = items
    .map((item) => {
      const { svg } = labelSvg(item, sizeId, dpi);
      return `<div class="label" style="width:${dim.wIn}in;height:${dim.hIn}in"><div class="label-art" style="width:${dim.wIn}in;height:${dim.hIn}in">${svg}</div></div>`;
    })
    .join("\n");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Label print verify ${dpi}dpi × ${items.length}</title>
<style>${css}</style>
</head>
<body>
  <div class="label-print-root">
    <div class="no-print">This banner must not appear on the printed page.</div>
    <div class="sheet">${labels}</div>
  </div>
</body>
</html>`;
}

const chris = samples[2];
writeFileSync(`${outDir}/print-1-label-300dpi.html`, printHtml([chris], 300));
writeFileSync(`${outDir}/print-3-labels-300dpi.html`, printHtml([samples[0], samples[1], chris], 300));
writeFileSync(`${outDir}/print-1-label-203dpi.html`, printHtml([chris], 203));
console.log("html", `${outDir}/print-1-label-300dpi.html`, `${outDir}/print-3-labels-300dpi.html`);
console.log("defaultDpi", DEFAULT_LABEL_DPI, "defaultSize", DEFAULT_LABEL_SIZE);
