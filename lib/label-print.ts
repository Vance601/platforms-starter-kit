import QRCode from "qrcode";
import { code128Modules, escapeXml } from "@/lib/code128-svg";

export type LabelItem = {
  id: string;
  barcode: string;
  model?: string | null;
  type?: string | null;
  /** Received or created date (ISO, YYYY-MM-DD, or MM/DD/YYYY). */
  date?: string | null;
};

// Physical sizes. 3×2 is the die-cut roll on the Duggers ZD421; 4×3 and
// the smaller sizes stay as options.
export const LABEL_SIZES = {
  "3x2": { id: "3x2", wIn: 3, hIn: 2, name: '3" × 2" die-cut (ZD421 stock)' },
  "4x3": { id: "4x3", wIn: 4, hIn: 3, name: '4" × 3"' },
  "4x2": { id: "4x2", wIn: 4, hIn: 2, name: '4" × 2"' },
  "2.25x1.25": { id: "2.25x1.25", wIn: 2.25, hIn: 1.25, name: '2.25" × 1.25"' },
  "2x1": { id: "2x1", wIn: 2, hIn: 1, name: '2" × 1"' },
  "4x6": { id: "4x6", wIn: 4, hIn: 6, name: '4" × 6" (shipping)' },
} as const;

export type LabelSizeId = keyof typeof LABEL_SIZES;
export const DEFAULT_LABEL_SIZE: LabelSizeId = "3x2";
export const LABEL_SIZE_STORAGE_KEY = "bc_label_size";
export const LABEL_DPIS = [203, 300] as const;
export type LabelDpi = (typeof LABEL_DPIS)[number];
/** Duggers' ZD421 is the 300 dpi model. 203 remains for older printers. */
export const DEFAULT_LABEL_DPI: LabelDpi = 300;
/** Alias of DEFAULT_LABEL_DPI so older call sites keep compiling. */
export const LABEL_DPI = DEFAULT_LABEL_DPI;
export const LABEL_DPI_STORAGE_KEY = "bc_label_dpi";
/** Keep content at least this far from every edge. */
export const SAFE_MARGIN_IN = 0.12;
/** Target QR size on 3×2 stock (and any label tall enough to allow it). */
export const QR_TARGET_MIN_IN = 1.3;
export const QR_TARGET_MAX_IN = 1.4;

export function parseLabelDpi(raw: unknown): LabelDpi {
  const n = typeof raw === "number" ? raw : Number(raw);
  return n === 203 || n === 300 ? (n as LabelDpi) : DEFAULT_LABEL_DPI;
}

export function labelDots(size: { wIn: number; hIn: number }, dpi: number) {
  return { W: Math.round(size.wIn * dpi), H: Math.round(size.hIn * dpi) };
}
/** Minimum Code 128 module width, in printer dots. */
export const MIN_CODE128_MODULE_DOTS = 3;
/** Minimum Code 128 quiet zone. */
export const MIN_CODE128_QUIET_IN = 0.25;

export function parseLabelSize(raw: string | null | undefined): LabelSizeId {
  return raw && raw in LABEL_SIZES ? (raw as LabelSizeId) : DEFAULT_LABEL_SIZE;
}

export function labelTypography(size: { wIn: number; hIn: number }) {
  return {
    padIn: SAFE_MARGIN_IN,
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
  { id: "demo-1", barcode: "TEST-20261111-0001", type: "124R", model: "Preview", date: "2026-11-11" },
];

/**
 * Format a received/created date as MM/DD/YYYY. Accepts ISO timestamps,
 * YYYY-MM-DD, or MM/DD/YYYY. Date-only values are not timezone-shifted.
 * If no date is provided, a YYYYMMDD segment in the barcode is used.
 */
export function formatLabelDate(raw?: string | null, barcode?: string): string {
  const fromRaw = parseToMMDDYYYY(raw);
  if (fromRaw) return fromRaw;
  const m = String(barcode || "").match(/(?:^|\D)(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:\D|$)/);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  return "";
}

function parseToMMDDYYYY(raw?: string | null): string {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[1].padStart(2, "0")}/${mdy[2].padStart(2, "0")}/${mdy[3]}`;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  const d = new Date(trimmed);
  if (!Number.isFinite(d.getTime())) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Phoenix",
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
    const out = `${get("month")}/${get("day")}/${get("year")}`;
    return out.includes("undefined") || out.includes("NaN") ? "" : out;
  } catch {
    return "";
  }
}

function monoCharWidth(fontH: number) {
  return fontH * 0.62;
}

function wrapLines(text: string, maxWidth: number, fontH: number, maxLines: number): string[] {
  const maxChars = Math.max(4, Math.floor(maxWidth / monoCharWidth(fontH)));
  if (!text) return [];
  if (text.length <= maxChars) return [text];
  const tokens = text.split("-").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  const push = (s: string) => {
    if (lines.length >= maxLines) return;
    lines.push(s);
  };
  for (const tok of tokens) {
    const next = cur ? `${cur}-${tok}` : tok;
    if (next.length <= maxChars) {
      cur = next;
      continue;
    }
    if (cur) push(cur);
    if (tok.length <= maxChars) {
      cur = tok;
    } else {
      for (let i = 0; i < tok.length && lines.length < maxLines; i += maxChars) {
        const slice = tok.slice(i, i + maxChars);
        if (i + maxChars >= tok.length) cur = slice;
        else push(slice);
      }
    }
  }
  if (cur && lines.length < maxLines) push(cur);
  if (lines.length === maxLines) {
    const used = lines.join("-").length;
    // If we dropped a tail, keep the last line as a short ID rather than a mid-cut.
    if (used < text.length && lines[maxLines - 1].length > 4) {
      // already filled
    }
  }
  return lines.slice(0, maxLines);
}


function textWidthDots(text: string, fontH: number) {
  return Math.ceil(Math.max(0, text.length) * monoCharWidth(fontH));
}

/** Split a battery ID into two lines at a dash closest to the midpoint. */
function splitIdTwoLines(data: string): string[] {
  if (!data) return [];
  const mid = Math.ceil(data.length / 2);
  let best = -1;
  let bestDist = Infinity;
  for (let i = 1; i < data.length - 1; i++) {
    if (data[i] === "-") {
      const dist = Math.abs(i - mid);
      if (dist < bestDist) {
        best = i;
        bestDist = dist;
      }
    }
  }
  if (best > 0) return [data.slice(0, best), data.slice(best + 1)];
  const half = Math.ceil(data.length / 2);
  return [data.slice(0, half), data.slice(half)];
}

/** Prefer one ID line when it stays readable; otherwise wrap to two. */
function fitIdLines(data: string, textW: number, dpi: number): { lines: string[]; fontH: number } {
  const minOneLine = Math.round(0.11 * dpi);
  const maxFont = Math.round(0.13 * dpi);
  if (!data) return { lines: [], fontH: Math.max(12, minOneLine) };
  const one = Math.floor(textW / (data.length * 0.62));
  if (one >= minOneLine) {
    return { lines: [data], fontH: Math.min(maxFont, one) };
  }
  const lines = splitIdTwoLines(data);
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const two = Math.floor(textW / (longest * 0.62));
  return { lines, fontH: Math.max(12, Math.min(maxFont, two)) };
}

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

export type LabelTextLine = {
  text: string;
  x: number;
  /** Top of the em-box, in dots. */
  y: number;
  fontH: number;
  weight: number;
};

export type LabelLayout = {
  dpi: number;
  W: number;
  H: number;
  pad: number;
  fontH: number;
  subH: number;
  data: string;
  date: string;
  sub: string;
  qr: { x: number; y: number; cell: number; quiet: number; size: number; bits: QrMatrix };
  code128: Code128Layout | null;
  lines: LabelTextLine[];
  textX: number;
  textW: number;
  textY: number;
  subY: number;
};


/**
 * Pixel-exact layout at the given printer dpi.
 * The QR + text (and Code 128, when it fits) are treated as one group and
 * centered horizontally and vertically, with ≥ 0.12" clearance on every
 * side. The QR is the scan target (~1.3–1.4" on 3×2). The text block is
 * vertically centered against the QR. Code 128 is included only when it
 * fits with a scannable module width, without overlapping or leaving the
 * margins.
 */
export function layoutLabel(
  item: LabelItem,
  sizeId: LabelSizeId = DEFAULT_LABEL_SIZE,
  dpi = LABEL_DPI,
): LabelLayout {
  const size = LABEL_SIZES[sizeId];
  const W = Math.round(size.wIn * dpi);
  const H = Math.round(size.hIn * dpi);
  const pad = Math.max(1, Math.round(SAFE_MARGIN_IN * dpi));
  const data = String(item.barcode || "");
  const date = formatLabelDate(item.date, data);
  // Model first, then size/type, e.g. "Bravo 78".
  const sub = [item.model, item.type].filter(Boolean).join(" ");
  const bits = qrMatrix(data);
  const qrQuiet = 4;
  const qrN = bits.length + qrQuiet * 2;
  const c128Bits = code128Modules(data);
  const minQuietPx = Math.ceil(MIN_CODE128_QUIET_IN * dpi);
  const usableW = Math.max(20, W - pad * 2);
  const gap = Math.max(8, Math.round(0.08 * dpi));

  const needed = (mod: number) => c128Bits.length * mod + 2 * Math.max(minQuietPx, 10 * mod);
  // At 300 dpi, 2-dot modules are 0.007" — too thin to scan reliably. 3 dots
  // (0.01") is the floor. 2 dots is only allowed at 203 dpi, where it is the
  // same physical width. If even that does not fit, drop Code 128; the QR is
  // the scan target.
  const minModule = dpi >= 300 ? MIN_CODE128_MODULE_DOTS : 2;
  let c128Module = 0;
  if (needed(minModule) <= usableW) {
    c128Module = minModule;
    while (needed(c128Module + 1) <= usableW && c128Module < 8) c128Module += 1;
  }
  const c128H = c128Module ? Math.max(Math.round(0.2 * dpi), Math.round(dpi * (size.hIn >= 2.5 ? 0.28 : 0.22))) : 0;
  const c128Gap = c128Module ? Math.max(8, Math.round(0.06 * dpi)) : 0;
  let c128Width = 0;
  let c128Quiet = 0;
  if (c128Module && c128H) {
    c128Quiet = Math.max(minQuietPx, 10 * c128Module);
    c128Width = c128Bits.length * c128Module + c128Quiet * 2;
  }

  // Date "MM/DD/YYYY" must fit on one line. Reserve ~1.15" for the text column.
  const minTextW = Math.round(Math.max(1.15, Math.min(1.35, size.wIn * 0.4)) * dpi);
  const barcodeReserve = c128Module ? c128H + c128Gap : 0;
  const innerH = Math.max(40, H - pad * 2 - barcodeReserve);
  const maxQrByWidth = usableW - gap - minTextW;
  const maxQrCap = Math.round(QR_TARGET_MAX_IN * dpi);
  const maxQr = Math.max(40, Math.min(innerH, maxQrByWidth, size.hIn >= 2 ? maxQrCap : innerH));
  let qrCell = Math.max(2, Math.floor(maxQr / qrN));
  // Prefer at least 1.3" on stock that can hold it, without exceeding 1.4" or the cap.
  const minQr = Math.round(QR_TARGET_MIN_IN * dpi);
  if (qrN * (qrCell + 1) <= maxQr && qrN * qrCell < minQr) {
    qrCell += 1;
  }
  const qrSize = qrN * qrCell;

  const textW = Math.max(20, W - pad * 2 - qrSize - gap);
  const dateFontH = Math.max(
    18,
    Math.min(Math.round(0.2 * dpi), Math.floor(textW / (10 * 0.62))),
  );
  const modelFontH = Math.max(14, Math.round(Math.min(0.15, Math.max(0.11, size.hIn * 0.07)) * dpi));
  const { lines: idLines, fontH: idFontH } = fitIdLines(data, textW, dpi);
  const lineGap = Math.max(6, Math.round(0.035 * dpi));

  const stack: { text: string; fontH: number; weight: number }[] = [];
  if (date) stack.push({ text: date, fontH: dateFontH, weight: 700 });
  if (sub) stack.push({ text: sub, fontH: modelFontH, weight: 600 });
  for (const t of idLines) stack.push({ text: t, fontH: idFontH, weight: 650 });

  const textBlockH =
    stack.reduce((sum, l, i) => sum + l.fontH + (i > 0 ? lineGap : 0), 0) || dateFontH;
  const actualTextW = Math.max(
    minTextW,
    ...stack.map((l) => textWidthDots(l.text, l.fontH)),
  );
  const pairW = qrSize + gap + Math.min(textW, actualTextW);

  // If the barcode would not actually fit under the QR+text group, drop it
  // before we compute the centered origin.
  let useC128 = Boolean(c128Module && c128H && c128Width <= usableW);
  if (useC128 && pad + qrSize + c128Gap + c128H + pad > H) useC128 = false;

  const groupW = Math.max(pairW, useC128 ? c128Width : 0);
  const groupH = qrSize + (useC128 ? c128Gap + c128H : 0);

  let groupX = Math.floor((W - groupW) / 2);
  let groupY = Math.floor((H - groupH) / 2);
  if (groupX < pad) groupX = pad;
  if (groupY < pad) groupY = pad;
  if (groupX + groupW > W - pad) groupX = Math.max(pad, W - pad - groupW);
  if (groupY + groupH > H - pad) groupY = Math.max(pad, H - pad - groupH);

  const qrX = groupX;
  const qrY = groupY;
  const textX = qrX + qrSize + gap;
  let textY0 = qrY + Math.max(0, Math.floor((qrSize - textBlockH) / 2));
  if (textY0 < pad) textY0 = pad;
  if (textY0 + textBlockH > H - pad) textY0 = Math.max(pad, H - pad - textBlockH);

  const lines: LabelTextLine[] = [];
  let y = textY0;
  for (const l of stack) {
    lines.push({ text: l.text, x: textX, y, fontH: l.fontH, weight: l.weight });
    y += l.fontH + lineGap;
  }

  let code128: Code128Layout | null = null;
  if (useC128) {
    const cY = qrY + qrSize + c128Gap;
    const cX = Math.max(pad, Math.floor((W - c128Width) / 2));
    const inBounds =
      cX >= pad &&
      cX + c128Width <= W - pad &&
      cY >= qrY + qrSize + Math.round(0.04 * dpi) &&
      cY + c128H <= H - pad &&
      textY0 + textBlockH <= cY - Math.round(0.04 * dpi);
    if (inBounds) {
      code128 = { x: cX, y: cY, module: c128Module, height: c128H, quietPx: c128Quiet, width: c128Width };
    }
  }

  const first = lines[0];
  const second = lines[1];
  return {
    dpi,
    W,
    H,
    pad,
    fontH: first?.fontH ?? dateFontH,
    subH: second?.fontH ?? modelFontH,
    data,
    date,
    sub,
    qr: { x: qrX, y: qrY, cell: qrCell, quiet: qrQuiet, size: qrSize, bits },
    code128,
    lines,
    textX,
    textW,
    textY: first?.y ?? textY0,
    subY: second?.y ?? textY0,
  };
}

/** Axis-aligned bounds of QR, text, and Code 128, in dots. */
export function labelContentBounds(layout: LabelLayout) {
  const xs: number[] = [layout.qr.x, layout.qr.x + layout.qr.size];
  const ys: number[] = [layout.qr.y, layout.qr.y + layout.qr.size];
  if (layout.code128) {
    xs.push(layout.code128.x, layout.code128.x + layout.code128.width);
    ys.push(layout.code128.y, layout.code128.y + layout.code128.height);
  }
  for (const l of layout.lines) {
    xs.push(l.x, l.x + textWidthDots(l.text, l.fontH));
    ys.push(l.y, l.y + l.fontH);
  }
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const x1 = Math.max(...xs);
  const y1 = Math.max(...ys);
  return {
    x0,
    y0,
    x1,
    y1,
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
    w: x1 - x0,
    h: y1 - y0,
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

/**
 * Full-label SVG. The viewBox is exact device pixels (1 user unit = 1 dot)
 * but width/height are in inches so browsers treat the graphic as the real
 * stock size, not as thousands of CSS pixels.
 */
export function labelSvg(
  item: LabelItem,
  sizeId: LabelSizeId = DEFAULT_LABEL_SIZE,
  dpi = LABEL_DPI,
): { svg: string; layout: LabelLayout } {
  const layout = layoutLabel(item, sizeId, dpi);
  const size = LABEL_SIZES[sizeId];
  const { W, H, data, lines } = layout;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size.wIn}in" height="${size.hIn}in" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" role="img" aria-label="${escapeXml(data)}">`,
    `<rect width="${W}" height="${H}" fill="#fff"/>`,
    `<g fill="#000" transform="translate(${layout.qr.x},${layout.qr.y})">${qrRects(layout)}</g>`,
    `<g fill="#000">${code128Rects(layout)}</g>`,
  ];
  for (const line of lines) {
    const baseline = line.y + Math.round(line.fontH * 0.8);
    // Date uses the system font so MM/DD/YYYY is clearly readable; IDs stay mono.
    const isDate = /^\d{2}\/\d{2}\/\d{4}$/.test(line.text);
    const font = isDate ? "system-ui, sans-serif" : "ui-monospace, Menlo, monospace";
    parts.push(
      `<text x="${line.x}" y="${baseline}" text-anchor="start" font-family="${font}" font-size="${line.fontH}" font-weight="${line.weight}" fill="#000">${escapeXml(line.text)}</text>`,
    );
  }

  parts.push("</svg>");
  return { svg: parts.join(""), layout };
}

/** 1-bit ^GFA graphic of the QR (including its 4-module quiet zone), 1 = black. */
function zplQrGraphic(layout: LabelLayout): string {
  const { qr } = layout;
  const size = qr.size;
  const rowBytes = Math.ceil(size / 8);
  const total = rowBytes * size;
  const origin = qr.quiet * qr.cell;
  const hex: string[] = [];
  for (let y = 0; y < size; y++) {
    for (let byte = 0; byte < rowBytes; byte++) {
      let v = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = byte * 8 + bit;
        let on = 0;
        if (x < size) {
          const mx = Math.floor((x - origin) / qr.cell);
          const my = Math.floor((y - origin) / qr.cell);
          if (mx >= 0 && my >= 0 && mx < qr.bits.length && my < qr.bits.length && qr.bits[my][mx]) on = 1;
        }
        v = (v << 1) | on;
      }
      hex.push(v.toString(16).padStart(2, "0"));
    }
  }
  return `^FO${qr.x},${qr.y}^GFA,${total},${total},${rowBytes},${hex.join("").toUpperCase()}^FS`;
}

/** ZPL II for a Zebra ZD421 (direct thermal). One ^XA..^XZ per label.
 *  Dots follow the given dpi: 3×2 is ^PW609/^LL406 at 203 dpi, or
 *  ^PW900/^LL600 at 300 dpi. */
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
    const { W, H, qr, code128, lines } = layout;
    const zplLines = [
      "^XA",
      "^CI28",
      `^PW${W}`,
      `^LL${H}`,
      "^LH0,0",
      "^LS0",
      "^LT0",
      "^PON",
      // Die-cut / gap media. ^MNN (continuous) was wrong for this stock and
      // made the printer ignore the gap, so length and placement drifted.
      "^MNW",
      "^PR4",
      // Native ^BQ magnification maxes out at 10. At 300 dpi the layout cell
      // can exceed that, so send the QR as an exact-dot graphic instead.
      qr.cell <= 10
        ? `^FO${qr.x},${qr.y}^BQN,2,${qr.cell}^FDQA,${data}^FS`
        : zplQrGraphic(layout),
    ];
    if (code128) {
      zplLines.push(
        `^FO${code128.x},${code128.y}^BY${code128.module},3,${code128.height}^BCN,${code128.height},N,N,N^FD${data}^FS`,
      );
    }
    for (const line of lines) {
      zplLines.push(
        `^FO${line.x},${line.y}^A0N,${line.fontH},${line.fontH}^FD${zplEscape(line.text)}^FS`,
      );
    }
    zplLines.push("^XZ");
    blocks.push(zplLines.join("\n"));
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

/** Print-only CSS shared by the labels page and the headless verification script.
 *  One label = one page, content box strictly equal to the @page size. */
export function labelPrintCss(size: { wIn: number; hIn: number }): string {
  const w = `${size.wIn}in`;
  const h = `${size.hIn}in`;
  return `
@page { size: ${w} ${h}; margin: 0; }
@media print {
  .no-print { display: none !important; }
  html, body, .label-print-root {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    color: #000 !important;
    min-height: 0 !important;
    height: auto !important;
    width: auto !important;
    overflow: visible !important;
    color-scheme: only light;
  }
  .sheet {
    display: block !important;
    padding: 0 !important;
    margin: 0 !important;
    gap: 0 !important;
  }
  .label {
    border: none !important;
    box-shadow: none !important;
    margin: 0 !important;
    padding: 0 !important;
    width: ${w} !important;
    height: ${h} !important;
    max-width: ${w} !important;
    max-height: ${h} !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    page-break-after: always;
    break-after: page;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .label:last-child,
  .label:last-of-type {
    page-break-after: auto;
    break-after: auto;
  }
  .label-art,
  .label-art svg {
    display: block !important;
    width: ${w} !important;
    height: ${h} !important;
    max-width: ${w} !important;
    max-height: ${h} !important;
    overflow: hidden !important;
  }
}
`.trim();
}
