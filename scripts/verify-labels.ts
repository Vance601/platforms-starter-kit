import { mkdirSync, writeFileSync } from "fs";
import { DEMO_LABELS, LABEL_DPI, labelSvg, rasterLabel, rasterToPbm, labelsToZpl } from "../lib/label-print";

const samples = [
  DEMO_LABELS[0],
  { id: "scan-sample", barcode: "DG-PHX-78-20261116-0001", type: "78", model: "Bravo" },
];

const outDir = "/tmp/label-verify";
mkdirSync(outDir, { recursive: true });

for (const item of samples) {
  const { width, height, mono, layout } = rasterLabel(item, "4x3", LABEL_DPI);
  const pbm = rasterToPbm(width, height, mono);
  const safe = item.barcode.replace(/[^A-Za-z0-9_-]+/g, "_");
  const pbmPath = `${outDir}/${safe}.pbm`;
  writeFileSync(pbmPath, pbm);
  const { svg } = labelSvg(item, "4x3", LABEL_DPI);
  writeFileSync(`${outDir}/${safe}.svg`, svg);
  console.log(JSON.stringify({
    barcode: item.barcode,
    pbm: pbmPath,
    width,
    height,
    dpi: LABEL_DPI,
    qrCell: layout.qr.cell,
    qrSize: layout.qr.size,
    code128Module: layout.code128?.module ?? null,
    code128QuietPx: layout.code128?.quietPx ?? null,
    code128Width: layout.code128?.width ?? null,
  }));
}

writeFileSync(`${outDir}/sample.zpl`, labelsToZpl(samples, "4x3", 1));
console.log("zpl", `${outDir}/sample.zpl`);
