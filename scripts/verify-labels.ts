import { mkdirSync, writeFileSync } from "fs";
import {
  DEMO_LABELS,
  DEFAULT_LABEL_DPI,
  DEFAULT_LABEL_SIZE,
  LABEL_SIZES,
  type LabelItem,
  type LabelDpi,
  type LabelOffset,
  type LabelSizeId,
  applyLabelOffset,
  formatLabelDate,
  labelContentBounds,
  labelOffsetDots,
  labelPrintCss,
  labelSvg,
  labelsToZpl,
  layoutLabel,
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

function writeBundle(item: LabelItem, dpi: LabelDpi, size: LabelSizeId = sizeId, offset: LabelOffset = { xIn: 0, yIn: 0 }) {
  const { width, height, mono, layout } = rasterLabel(item, size, dpi, offset);
  const safe = safeName(item.barcode, dpi, size);
  const pbmPath = `${outDir}/${safe}.pbm`;
  writeFileSync(pbmPath, rasterToPbm(width, height, mono));
  const { svg } = labelSvg(item, size, dpi, offset);
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
      bounds: labelContentBounds(layout),
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

function printHtml(items: LabelItem[], dpi: LabelDpi, offset: LabelOffset = { xIn: 0, yIn: 0 }) {
  const labels = items
    .map((item) => {
      const { svg } = labelSvg(item, sizeId, dpi, offset);
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

const chris = samples[1]; // DG-PHX-78-20261116-0001, the label Chris just printed
writeFileSync(`${outDir}/print-1-label-300dpi.html`, printHtml([chris], 300));
writeFileSync(`${outDir}/print-3-labels-300dpi.html`, printHtml(samples, 300));
writeFileSync(`${outDir}/print-1-label-203dpi.html`, printHtml([chris], 203));
console.log("html", `${outDir}/print-1-label-300dpi.html`, `${outDir}/print-3-labels-300dpi.html`);
console.log("defaultDpi", DEFAULT_LABEL_DPI, "defaultSize", DEFAULT_LABEL_SIZE);

const DUGGERS_OFFSET: LabelOffset = { xIn: 0.28, yIn: 0.4 };
writeFileSync(`${outDir}/print-1-label-300dpi-offset.html`, printHtml([chris], 300, DUGGERS_OFFSET));
writeFileSync(`${outDir}/sample-300dpi-offset.zpl`, labelsToZpl([chris], sizeId, 1, 300, DUGGERS_OFFSET));
writeBundle(chris, 300, sizeId, DUGGERS_OFFSET);

const zpl300 = labelsToZpl([chris], sizeId, 1, 300);
const { layout: chrisLayout } = labelSvg(chris, sizeId, 300);
const fos = [...zpl300.matchAll(/\^FO(-?\d+),(-?\d+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
const expected = [
  { x: chrisLayout.qr.x, y: chrisLayout.qr.y },
  ...chrisLayout.lines.map((l) => ({ x: l.x, y: l.y })),
];
if (chrisLayout.code128) expected.push({ x: chrisLayout.code128.x, y: chrisLayout.code128.y });
const foMatch =
  fos.length === expected.length && fos.every((f, i) => f.x === expected[i].x && f.y === expected[i].y);
const bounds = labelContentBounds(chrisLayout);
console.log(
  JSON.stringify({
    zplOriginsMatch: foMatch,
    fos,
    expected,
    hasLH0: zpl300.includes("^LH0,0"),
    hasLS0: zpl300.includes("^LS0"),
    hasLT0: zpl300.includes("^LT0"),
    pwll: { pw: chrisLayout.W, ll: chrisLayout.H },
    bounds,
    centerOffsetIn: {
      dx: (bounds.cx - chrisLayout.W / 2) / chrisLayout.dpi,
      dy: (bounds.cy - chrisLayout.H / 2) / chrisLayout.dpi,
    },
  }),
);

const baseLayout = layoutLabel(chris, sizeId, 300);
const shiftedLayout = applyLabelOffset(baseLayout, DUGGERS_OFFSET);
const dots = labelOffsetDots(DUGGERS_OFFSET, 300);
const zplOffset = labelsToZpl([chris], sizeId, 1, 300, DUGGERS_OFFSET);
const fosOffset = [...zplOffset.matchAll(/\^FO(-?\d+),(-?\d+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
const expectedOffset = [
  { x: shiftedLayout.qr.x, y: shiftedLayout.qr.y },
  ...shiftedLayout.lines.map((l) => ({ x: l.x, y: l.y })),
];
if (shiftedLayout.code128) expectedOffset.push({ x: shiftedLayout.code128.x, y: shiftedLayout.code128.y });
const foOffsetMatch =
  fosOffset.length === expectedOffset.length &&
  fosOffset.every((f, i) => f.x === expectedOffset[i].x && f.y === expectedOffset[i].y);
const dxQr = shiftedLayout.qr.x - baseLayout.qr.x;
const dyQr = shiftedLayout.qr.y - baseLayout.qr.y;
const linesMoved = baseLayout.lines.every((l, i) => shiftedLayout.lines[i].x - l.x === dots.dx && shiftedLayout.lines[i].y - l.y === dots.dy);
console.log(
  JSON.stringify({
    offset: DUGGERS_OFFSET,
    offsetDots: dots,
    expectedDots: { dx: 84, dy: -120 },
    dotsMatch: dots.dx === 84 && dots.dy === -120,
    qrDelta: { dx: dxQr, dy: dyQr },
    linesMoved,
    zplOffsetOriginsMatch: foOffsetMatch,
    fosOffset,
    expectedOffset,
    qrSizeIn: shiftedLayout.qr.size / 300,
    idLines: shiftedLayout.lines.map((l) => l.text),
  }),
);
