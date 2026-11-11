export type LabelItem = {
  id: string;
  barcode: string;
  model?: string | null;
  type?: string | null;
};

export const LABEL_SIZES = {
  "2x1": { id: "2x1", wIn: 2, hIn: 1, name: '2" × 1" (ZD421 default)' },
  "2.25x1.25": { id: "2.25x1.25", wIn: 2.25, hIn: 1.25, name: '2.25" × 1.25"' },
  "3x2": { id: "3x2", wIn: 3, hIn: 2, name: '3" × 2"' },
  "4x6": { id: "4x6", wIn: 4, hIn: 6, name: '4" × 6" (shipping)' },
} as const;

export type LabelSizeId = keyof typeof LABEL_SIZES;

export function parseLabelSize(raw: string | null | undefined): LabelSizeId {
  return raw && raw in LABEL_SIZES ? (raw as LabelSizeId) : "2x1";
}

export const PRINT_LABELS_SESSION_KEY = "bc_print_labels";

export type PrintLabelsPayload = {
  labels: LabelItem[];
  size?: LabelSizeId;
  copies?: number;
};

/** ZPL II for a Zebra ZD421 (direct thermal, 203 dpi). One ^XA..^XZ per label. */
export function labelsToZpl(
  labels: LabelItem[],
  sizeId: LabelSizeId = "2x1",
  copies = 1,
  dpi = 203,
): string {
  const size = LABEL_SIZES[sizeId];
  const W = Math.round(size.wIn * dpi);
  const H = Math.round(size.hIn * dpi);
  const pad = Math.round(0.06 * dpi);
  const barcodeH = Math.max(40, Math.round(H * (size.hIn >= 2 ? 0.4 : 0.48)));
  const fontH = Math.max(16, Math.round(H * 0.12));
  const n = Math.max(1, Math.min(99, Math.floor(copies) || 1));
  const blocks: string[] = [];
  const repeat = labels.flatMap((l) => Array.from({ length: n }, () => l));
  for (const l of repeat) {
    const data = zplEscape(l.barcode);
    const sub = [l.type, l.model].filter(Boolean).join("  ");
    // Module width 1–3 so a ~24-char Battery City barcode fits a 2" label.
    const by = l.barcode.length > 18 ? 1 : 2;
    const lines = [
      "^XA",
      "^CI28",
      `^PW${W}`,
      `^LL${H}`,
      "^LH0,0",
      "^MNN", // no extra media tracking offset
      `^FO${pad},${pad}^BY${by},3,${barcodeH}^BCN,${barcodeH},N,N,N^FD${data}^FS`,
      `^FO${pad},${pad + barcodeH + 4}^A0N,${fontH},${fontH}^FD${data}^FS`,
    ];
    if (sub) {
      lines.push(
        `^FO${pad},${pad + barcodeH + 4 + fontH + 2}^A0N,${Math.max(14, fontH - 4)},${Math.max(14, fontH - 4)}^FD${zplEscape(sub)}^FS`,
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
