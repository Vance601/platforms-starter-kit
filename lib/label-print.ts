import { code128Modules } from "@/lib/code128-svg";

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

export function parseLabelSize(raw: string | null | undefined): LabelSizeId {
  return raw && raw in LABEL_SIZES ? (raw as LabelSizeId) : DEFAULT_LABEL_SIZE;
}

export function labelTypography(size: { wIn: number; hIn: number }) {
  return {
    padIn: Math.min(0.22, Math.max(0.14, size.wIn * 0.05)),
    codeIn: Math.max(0.15, Number((size.hIn * 0.09).toFixed(3))),
    subIn: Math.max(0.12, Number((size.hIn * 0.07).toFixed(3))),
    barcodeFrac: size.hIn >= 2.5 ? 0.55 : size.hIn >= 2 ? 0.5 : 0.45,
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

/** ZPL II for a Zebra ZD421 (direct thermal, 203 dpi). One ^XA..^XZ per label. */
export function labelsToZpl(
  labels: LabelItem[],
  sizeId: LabelSizeId = DEFAULT_LABEL_SIZE,
  copies = 1,
  dpi = LABEL_DPI,
): string {
  const size = LABEL_SIZES[sizeId];
  const typo = labelTypography(size);
  const W = Math.round(size.wIn * dpi);
  const H = Math.round(size.hIn * dpi);
  const pad = Math.round(typo.padIn * dpi);
  const barcodeH = Math.max(80, Math.round(H * typo.barcodeFrac));
  const fontH = Math.max(22, Math.round(typo.codeIn * dpi));
  const subH = Math.max(18, Math.round(typo.subIn * dpi));
  const n = Math.max(1, Math.min(99, Math.floor(copies) || 1));
  const blocks: string[] = [];
  const repeat = labels.flatMap((l) => Array.from({ length: n }, () => l));
  for (const l of repeat) {
    const data = zplEscape(l.barcode);
    const sub = [l.type, l.model].filter(Boolean).join("  ");
    const modules = code128Modules(l.barcode).length;
    const usable = Math.max(40, W - pad * 2);
    // Leave ~20 modules for the Code 128 quiet zones ZPL adds itself.
    const by = Math.max(2, Math.min(6, Math.floor(usable / (modules + 20))));
    const barW = (modules + 20) * by;
    const barX = Math.max(pad, Math.floor((W - barW) / 2));
    const barY = Math.max(pad, Math.floor((H - barcodeH - fontH - (sub ? subH + 8 : 0) - pad) / 2));
    const textY = barY + barcodeH + 8;
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
      `^FO${barX},${barY}^BY${by},3,${barcodeH}^BCN,${barcodeH},N,N,N^FD${data}^FS`,
      `^FO${pad},${textY}^FB${W - pad * 2},1,0,C^A0N,${fontH},${fontH}^FD${data}^FS`,
    ];
    if (sub) {
      lines.push(
        `^FO${pad},${textY + fontH + 6}^FB${W - pad * 2},1,0,C^A0N,${subH},${subH}^FD${zplEscape(sub)}^FS`,
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
