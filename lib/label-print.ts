import QRCode from "qrcode";
import { code128Modules, escapeXml } from "@/lib/code128-svg";

export type LabelItem = {
  id: string;
  barcode: string;
  model?: string | null;
  type?: string | null;
};

// Physical sizes Chris (and anyone else) can pick. 4×3 is the ZD421 die-cut
// stock in use; it is the default. Older 2×1 is kept as an option.
export const LABEL_SIZES = {
  "4x3": { id: "4x3", wIn: 4, hIn: 3, name: '4" × 3" die-cut (ZD421 stock)' },
  "4x2": { id: "4x2", wIn: 4, hIn: 2, name: '4" × 2"' },
  "3x2": { id: "3x2", wIn: 3, hIn: 2, name: '3" × 2"' },
  "2.25x1.25": { id: "2.25x1.25", wIn: 2.25, hIn: 1.25, name: '2.25" × 1.25"' },
  "2x1": { id: "2x1", wIn: 2, hIn: 1, name: '2" × 1"' },
  "4x6": { id: "4x6", wIn: 4, hIn: 6, name: '4" × 6" (shipping)' },
} as const;

export type LabelSizeId = keyof typeof LABEL_SIZES;
export const DEFAULT_LABEL_SIZE: LabelSizeId = "4x3";
/** Zebra ZD421 standard resolution. */
export const LABEL_DPI = 203;
/** Minimum Code 128 module width, in printer dots. */
export const MIN_CODE128_MODULE_DOTS = 3;
/** Minimum Code 128 quiet zone. */
export const MIN_CODE128_QUIET_IN = 0.25;

export function parseLabelSize(raw: string | null | undefined): LabelSizeId {
  return raw && raw in LABEL_SIZES ? (raw as LabelSizeId) : DEFAULT_LABEL_SIZE;
}

export function labelTypography(size: { wIn: number; hIn: number }) {
  return {
    padIn: Math.min(0.22, Math.max(0.14, size.wIn * 0.05)),
    codeIn: Math.max(0.13, Number((size.hIn * 0.08).toFixed(3))),
    subIn: Math.max(0.11, Number((size.hIn * 0.06).toFixed(3))),
  };
}

export const PRINT_LABELS_SESSION_KEY = "bc_print_labels";

export type PrintLabelsPayload = {
  labels: LabelItem[];
  size?: LabelSizeId;
  copies?: number;
};

export const DEMO_LABELS: LabelItem[] = [
  { id: "demo-1", barcode: "TEST-20261111-0001", type: "124R", model: "Preview" },
];

export type QrMatrix = boolean[][];

export function qrMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const bits: QrMatrix = [];
  for (let y = 0; y < n; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < n; x++) row.push(!!qr.modules.get(x, y));
    bits.push(row);
  }
  return bits;
}

export type Code128Layout = {
  x: number;
  y: number;
  module: number;
  height: number;
  quietPx: number;
  width: number;
};

export type LabelLayout = {
  dpi: number;
  W: number;
  H: number;
  pad: number;
  fontH: number;
  subH: number;
  data: string;
  sub: string;
  qr: { x: number; y: number; cell: number; quiet: number; size: number; bits: QrMatrix };
  code128: Code128Layout | null;
  textY: number;
  subY: number;
};

/**
 * Pixel-exact 203 dpi layout. QR is the primary symbol (large, integer cell
 * size, 4-module quiet zone). Code 128 sits under it only when it fits with
 * integer modules (prefer ≥3 dots) and ≥0.25" quiet zones. Nothing is
 * fractionally scaled.
 */
export function layoutLabel(
  item: LabelItem,
  sizeId: LabelSizeId = DEFAULT_LABEL_SIZE,
  dpi = LABEL_DPI,
): LabelLayout {
  const size = LABEL_SIZES[sizeId];
  const typo = labelTypography(size);
  const W = Math.round(size.wIn * dpi);
  const H = Math.round(size.hIn * dpi);
  const pad = Math.round(typo.padIn * dpi);
  const fontH = Math.max(22, Math.round(typo.codeIn * dpi));
  const subH = Math.max(18, Math.round(typo.subIn * dpi));
  const data = String(item.barcode || "");
  const sub = [item.type, item.model].filter(Boolean).join("  ");
  const bits = qrMatrix(data);
  const qrQuiet = 4;
  const qrN = bits.length + qrQuiet * 2;
  const c128Bits = code128Modules(data);
  const minQuietPx = Math.ceil(MIN_CODE128_QUIET_IN * dpi);
  const usableW = Math.max(20, W - pad * 2);

  const needed = (mod: number) => c128Bits.length * mod + 2 * Math.max(minQuietPx, 10 * mod);
  let c128Module = 0;
  if (needed(MIN_CODE128_MODULE_DOTS) <= usableW) {
    c128Module = MIN_CODE128_MODULE_DOTS;
    while (needed(c128Module + 1) <= usableW && c128Module < 8) c128Module += 1;
  } else if (needed(2) <= usableW) {
    // Long IDs on narrow stock cannot fit module 3 plus 0.25" quiet; keep
    // integer 2-dot bars. The QR above is the reliable scan target.
    c128Module = 2;
  }

  const textBlock = fontH + (sub ? subH + 8 : 0) + 10;
  const c128H = c128Module ? Math.max(36, Math.round(dpi * (size.hIn >= 2.5 ? 0.38 : 0.28))) : 0;
  const gap = c128Module ? 10 : 0;
  const remainingH = Math.max(40, H - pad * 2 - textBlock - (c128H ? c128H + gap : 0));
  const qrCell = Math.max(2, Math.floor(Math.min(remainingH, usableW) / qrN));
  const qrSize = qrN * qrCell;

  const contentH = qrSize + (c128H ? gap + c128H : 0) + textBlock;
  let y = Math.max(pad, Math.floor((H - contentH) / 2));
  const qrX = Math.max(pad, Math.floor((W - qrSize) / 2));
  const qrY = y;
  y += qrSize;

  let code128: Code128Layout | null = null;
  if (c128Module && c128H) {
    y += gap;
    const quietPx = Math.max(minQuietPx, 10 * c128Module);
    const width = c128Bits.length * c128Module + quietPx * 2;
    const x = Math.max(pad, Math.floor((W - width) / 2));
    code128 = { x, y, module: c128Module, height: c128H, quietPx, width };
    y += c128H;
  }
  y += 8;
  const textY = y;
  const subY = textY + fontH + 6;

  return {
    dpi, W, H, pad, fontH, subH, data, sub,
    qr: { x: qrX, y: qrY, cell: qrCell, quiet: qrQuiet, size: qrSize, bits },
    code128, textY, subY,
  };
}

function qrRects(layout: LabelLayout): string {
  const { qr } = layout;
  const origin = qr.quiet * qr.cell;
  const rects: string[] = [];
  const n = qr.bits.length;
  for (let y = 0; y < n; y++) {
    let run = 0;
    let runX = 0;
    for (let x = 0; x <= n; x++) {
      const on = x < n && qr.bits[y][x];
      if (on) {
        if (!run) runX = x;
        run++;
      } else if (run) {
        rects.push(
          `<rect x="${origin + runX * qr.cell}" y="${origin + y * qr.cell}" width="${run * qr.cell}" height="${qr.cell}"/>`,
        );
        run = 0;
      }
    }
  }
  return rects.join("");
}

function code128Rects(layout: LabelLayout): string {
  const c = layout.code128;
  if (!c) return "";
  const bits = code128Modules(layout.data);
  const rects: string[] = [];
  let x = c.x + c.quietPx;
  let run = 0;
  let runStart = x;
  for (let i = 0; i <= bits.length; i++) {
    if (bits[i] === "1") {
      if (!run) runStart = x;
      run++;
    } else if (run) {
      rects.push(`<rect x="${runStart}" y="${c.y}" width="${run * c.module}" height="${c.height}"/>`);
      run = 0;
    }
    if (i < bits.length) x += c.module;
  }
  return rects.join("");
}

/** Full-label SVG at exact device pixels (1 user unit = 1 dot). */
export function labelSvg(
  item: LabelItem,
  sizeId: LabelSizeId = DEFAULT_LABEL_SIZE,
  dpi = LABEL_DPI,
): { svg: string; layout: LabelLayout } {
  const layout = layoutLabel(item, sizeId, dpi);
  const { W, H, fontH, subH, data, sub, textY, subY, pad } = layout;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" role="img" aria-label="${escapeXml(data)}">`,
    `<rect width="${W}" height="${H}" fill="#fff"/>`,
    `<g fill="#000">${qrRects(layout)}${code128Rects(layout)}</g>`,
    `<text x="${W / 2}" y="${textY + fontH - 4}" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="${fontH}" font-weight="650" fill="#000">${escapeXml(data)}</text>`,
  ];
  if (sub) {
    parts.push(
      `<text x="${W / 2}" y="${subY + subH - 4}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${subH}" font-weight="600" fill="#111">${escapeXml(sub)}</text>`,
    );
  }
  parts.push("</svg>");
  return { svg: parts.join(""), layout };
}

/** ZPL II for a Zebra ZD421 (direct thermal, 203 dpi). One ^XA..^XZ per label. */
export function labelsToZpl(
  labels: LabelItem[],
  sizeId: LabelSizeId = DEFAULT_LABEL_SIZE,
  copies = 1,
  dpi = LABEL_DPI,
): string {
  const n = Math.max(1, Math.min(99, Math.floor(copies) || 1));
  const blocks: string[] = [];
  const repeat = labels.flatMap((l) => Array.from({ length: n }, () => l));
  for (const l of repeat) {
    const layout = layoutLabel(l, sizeId, dpi);
    const data = zplEscape(layout.data);
    const sub = zplEscape(layout.sub);
    const { W, H, pad, fontH, subH, qr, code128, textY, subY } = layout;
    // ^BQ magnification is the cell size in dots (typically 1–10).
    const mag = Math.max(1, Math.min(10, qr.cell));
    const lines = [
      "^XA",
      "^CI28",
      `^PW${W}`,
      `^LL${H}`,
      "^LH0,0",
      "^LS0",
      "^LT0",
      // Die-cut / gap media. ^MNN (continuous) was wrong for this stock and
      // made the printer ignore the gap, so length and placement drifted.
      "^MNW",
      "^PR4",
      // QR is the primary symbol (model 2, enhanced). FO is the top-left of
      // the symbol including the 4-module quiet zone we reserved.
      `^FO${qr.x},${qr.y}^BQN,2,${mag}^FDQA,${data}^FS`,
    ];
    if (code128) {
      lines.push(
        `^FO${code128.x},${code128.y}^BY${code128.module},3,${code128.height}^BCN,${code128.height},N,N,N^FD${data}^FS`,
      );
    }
    lines.push(
      `^FO${pad},${textY}^FB${W - pad * 2},1,0,C^A0N,${fontH},${fontH}^FD${data}^FS`,
    );
    if (sub) {
      lines.push(
        `^FO${pad},${subY}^FB${W - pad * 2},1,0,C^A0N,${subH},${subH}^FD${sub}^FS`,
      );
    }
    lines.push("^XZ");
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n") + "\n";
}

function zplEscape(s: string): string {
  // ^ and ~ are ZPL control prefixes; _ is the default escape when ^FH is not used.
  return String(s || "").replace(/[\^~]/g, " ");
}


/** 1 = black, 0 = white, row-major, exact device pixels. Text is omitted so it cannot smear the symbols. */
export function rasterLabel(
  item: LabelItem,
  sizeId: LabelSizeId = DEFAULT_LABEL_SIZE,
  dpi = LABEL_DPI,
): { width: number; height: number; mono: Uint8Array; layout: LabelLayout } {
  const layout = layoutLabel(item, sizeId, dpi);
  const { W, H, qr, code128, data } = layout;
  const mono = new Uint8Array(W * H);
  const set = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < W && y < H) mono[y * W + x] = 1;
  };
  const origin = qr.quiet * qr.cell;
  for (let y = 0; y < qr.bits.length; y++) {
    for (let x = 0; x < qr.bits.length; x++) {
      if (!qr.bits[y][x]) continue;
      const x0 = qr.x + origin + x * qr.cell;
      const y0 = qr.y + origin + y * qr.cell;
      for (let dy = 0; dy < qr.cell; dy++) {
        for (let dx = 0; dx < qr.cell; dx++) set(x0 + dx, y0 + dy);
      }
    }
  }
  if (code128) {
    const bits = code128Modules(data);
    let x = code128.x + code128.quietPx;
    for (let i = 0; i < bits.length; i++) {
      if (bits[i] === "1") {
        for (let dy = 0; dy < code128.height; dy++) {
          for (let dx = 0; dx < code128.module; dx++) set(x + dx, code128.y + dy);
        }
      }
      x += code128.module;
    }
  }
  return { width: W, height: H, mono, layout };
}

/** Binary PBM (P4) that Pillow and zbarimg can open. */
export function rasterToPbm(width: number, height: number, mono: Uint8Array): Buffer {
  const header = Buffer.from(`P4\n${width} ${height}\n`, "ascii");
  const rowBytes = Math.ceil(width / 8);
  const body = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mono[y * width + x]) {
        const i = y * rowBytes + (x >> 3);
        body[i] |= 1 << (7 - (x & 7));
      }
    }
  }
  return Buffer.concat([header, body]);
}
