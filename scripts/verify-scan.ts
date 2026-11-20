import { writeFileSync, mkdirSync } from "fs";
import QRCode from "qrcode";
import {
  DEMO_LABELS,
  type LabelItem,
  rasterLabel,
} from "../lib/label-print";
import { findScannedItem, matchesScannedItem, normalizeScanText, scanKey } from "../lib/scan-code";
import { decodeQrImageData } from "../lib/scan-decode";

const outDir = process.env.SCAN_VERIFY_DIR || "/tmp/scan-verify";
mkdirSync(outDir, { recursive: true });

let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`PASS  ${name}`);
  else {
    failed++;
    console.log(`FAIL  ${name}`, detail === undefined ? "" : detail);
  }
}

// --- parse / match helpers ---
const sample = "DG-PHX-78-20261116-0001";
check("trim whitespace", normalizeScanText(`  ${sample}\n`) === sample);
check("strip quotes", normalizeScanText(`"${sample}"`) === sample);
check("url path", normalizeScanText(`https://www.battery-city.com/b/${sample}`) === sample);
check("url query", normalizeScanText(`https://example.com/scan?barcode=${sample}`) === sample);
check("lowercase match", matchesScannedItem({ barcode: sample }, sample.toLowerCase()));
check(
  "serial match",
  matchesScannedItem({ barcode: "OTHER", serial_number: "SN-99" }, "sn-99"),
);
check(
  "no false match",
  !matchesScannedItem({ barcode: sample }, "DG-PHX-78-20261116-0002"),
);
check(
  "find in list",
  findScannedItem(
    [
      { barcode: "TEST-20261111-0001" },
      { barcode: sample, serial_number: null },
    ],
    ` \n${sample} `,
  )?.barcode === sample,
);
check("truck qr normalize", scanKey("dg-truck-125") === "DG-TRUCK-125");
check("empty", normalizeScanText("   ") === "");

// --- Decode actual 3×2 label QR rasters with jsQR (no BarcodeDetector) ---
const items: LabelItem[] = [
  DEMO_LABELS[0],
  { id: "scan-sample", barcode: "DG-PHX-78-20261116-0001", type: "78", model: "Bravo", date: "2026-11-16" },
  { id: "long-sample", barcode: "DG-PHX-31xxD-20261118-0001", type: "AGM", model: "31xxD", date: "2026-11-18" },
];

function monoToRgba(width: number, height: number, mono: Uint8Array): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const v = mono[i] ? 0 : 255;
    const o = i * 4;
    rgba[o] = v;
    rgba[o + 1] = v;
    rgba[o + 2] = v;
    rgba[o + 3] = 255;
  }
  return rgba;
}

for (const item of items) {
  const { width, height, mono, layout } = rasterLabel(item, "3x2", 300);
  const rgba = monoToRgba(width, height, mono);
  const decoded = decodeQrImageData(rgba, width, height);
  const payload = decoded?.text || "";
  const name = `jsQR 3x2 300dpi ${item.barcode}`;
  check(name, payload === item.barcode, { payload, expected: item.barcode, decoder: decoded?.decoder, qrSize: layout.qr.size });
  check(`${item.barcode} matches inventory after decode`, matchesScannedItem(item, payload));
}

// Same labels at 203 dpi (older printers) still have a scannable QR.
for (const item of items) {
  const { width, height, mono } = rasterLabel(item, "3x2", 203);
  const decoded = decodeQrImageData(monoToRgba(width, height, mono), width, height);
  check(`jsQR 3x2 203dpi ${item.barcode}`, decoded?.text === item.barcode, { payload: decoded?.text });
}

// Truck windshield QR — same parser the claim-truck flow uses.
async function truckQr() {
  const code = "DG-TRUCK-125";
  const png = await QRCode.toBuffer(code, { type: "png", errorCorrectionLevel: "M", margin: 4, width: 400 });
  writeFileSync(`${outDir}/truck-qr.png`, png);
  // Decode via qrcode package's raw matrix rendered to RGBA (no png decoder required).
  const qr = QRCode.create(code, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const quiet = 4;
  const cell = 8;
  const size = (n + quiet * 2) * cell;
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const mx = Math.floor(x / cell) - quiet;
      const my = Math.floor(y / cell) - quiet;
      const black = mx >= 0 && my >= 0 && mx < n && my < n && qr.modules.get(mx, my);
      const o = (y * size + x) * 4;
      const v = black ? 0 : 255;
      rgba[o] = v; rgba[o + 1] = v; rgba[o + 2] = v; rgba[o + 3] = 255;
    }
  }
  const decoded = decodeQrImageData(rgba, size, size);
  check("jsQR truck windshield QR", decoded?.text === code, { payload: decoded?.text });
  check("truck QR normalizes", scanKey(decoded?.text || "") === code);
}

// Explicitly document the no-BarcodeDetector path: decodeQrImageData is jsQR only.
check("jsQR path does not require BarcodeDetector", typeof (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector === "undefined");

void truckQr().then(finish, (err) => { console.error(err); process.exit(1); });

function finish() {
  if (failed) {
    console.log(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll scan checks passed");
}
