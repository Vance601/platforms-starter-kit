// Frame decoders used by the in-app camera scanner. BarcodeDetector (when the
// browser actually lists the format) is tried first; jsQR is the QR fallback
// that works on iOS Safari, where BarcodeDetector is often missing or incomplete;
// ZXing covers Code 128 / Code 39 / Data Matrix for VIN and 1D battery bars.
import jsQR from "jsqr";

export type ScanFormat =
  | "qr_code"
  | "code_128"
  | "code_39"
  | "data_matrix"
  | "pdf_417"
  | "aztec"
  | "ean_13"
  | "ean_8"
  | "upc_a"
  | "upc_e"
  | "codabar"
  | "itf"
  | "code_93";

export const BATTERY_SCAN_FORMATS: ScanFormat[] = ["qr_code", "code_128"];
export const VIN_SCAN_FORMATS: ScanFormat[] = ["code_39", "code_128", "data_matrix", "qr_code"];

export type DecodeResult = {
  text: string;
  format: string;
  decoder: "barcodeDetector" | "jsQR" | "zxing";
};

type DetectorCtor = {
  new (opts?: { formats?: string[] }): {
    detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string; format: string; boundingBox?: { width: number; height: number } }>>;
  };
  getSupportedFormats?: () => Promise<string[]>;
};

function detectorCtor(): DetectorCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  return ctor || null;
}

/** Formats the native BarcodeDetector actually supports, or [] if unusable. */
export async function nativeDetectorFormats(): Promise<ScanFormat[]> {
  const ctor = detectorCtor();
  if (!ctor) return [];
  if (typeof ctor.getSupportedFormats !== "function") {
    // Constructor exists but we cannot verify QR support (older stubs). Do not
    // trust it — iOS Safari historically exposed a partial implementation.
    return [];
  }
  try {
    const list = await ctor.getSupportedFormats();
    return (list || []).map((f) => String(f).toLowerCase().replace("-", "_")) as ScanFormat[];
  } catch {
    return [];
  }
}

export function decodeQrImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): DecodeResult | null {
  if (!width || !height || data.length < 4) return null;
  const result = jsQR(data, width, height, { inversionAttempts: "attemptBoth" });
  const text = result?.data?.trim();
  if (!text) return null;
  return { text, format: "qr_code", decoder: "jsQR" };
}

async function decodeWithDetector(
  canvas: HTMLCanvasElement,
  want: ScanFormat[],
  supported: ScanFormat[],
): Promise<DecodeResult | null> {
  const ctor = detectorCtor();
  if (!ctor) return null;
  const formats = want.filter((f) => supported.includes(f));
  if (!formats.length) return null;
  try {
    const detector = new ctor({ formats });
    const found = await detector.detect(canvas);
    if (!found?.length) return null;
    let best = found[0];
    let bestArea = 0;
    for (const b of found) {
      const area = (b.boundingBox?.width || 0) * (b.boundingBox?.height || 0);
      if (area >= bestArea) {
        bestArea = area;
        best = b;
      }
    }
    const text = (best.rawValue || "").trim();
    if (!text) return null;
    return { text, format: String(best.format || "unknown"), decoder: "barcodeDetector" };
  } catch {
    return null;
  }
}

let zxingReader: { decodeFromCanvas: (c: HTMLCanvasElement) => Promise<DecodeResult | null> } | null = null;
let zxingFailed = false;

async function decodeWithZxing(canvas: HTMLCanvasElement, want: ScanFormat[]): Promise<DecodeResult | null> {
  if (zxingFailed) return null;
  try {
    if (!zxingReader) {
      const zxing = await import("@zxing/library");
      const formats: unknown[] = [];
      const map: Record<string, unknown> = {
        qr_code: zxing.BarcodeFormat.QR_CODE,
        code_128: zxing.BarcodeFormat.CODE_128,
        code_39: zxing.BarcodeFormat.CODE_39,
        code_93: zxing.BarcodeFormat.CODE_93,
        data_matrix: zxing.BarcodeFormat.DATA_MATRIX,
        pdf_417: zxing.BarcodeFormat.PDF_417,
        aztec: zxing.BarcodeFormat.AZTEC,
        ean_13: zxing.BarcodeFormat.EAN_13,
        ean_8: zxing.BarcodeFormat.EAN_8,
        upc_a: zxing.BarcodeFormat.UPC_A,
        upc_e: zxing.BarcodeFormat.UPC_E,
        codabar: zxing.BarcodeFormat.CODABAR,
        itf: zxing.BarcodeFormat.ITF,
      };
      for (const f of want) if (map[f] !== undefined) formats.push(map[f]);
      const hints = new Map();
      hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, formats);
      hints.set(zxing.DecodeHintType.TRY_HARDER, true);
      const reader = new zxing.MultiFormatReader();
      reader.setHints(hints);
      zxingReader = {
        decodeFromCanvas: async (c) => {
          const luminance = new zxing.HTMLCanvasElementLuminanceSource(c);
          const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(luminance));
          try {
            const result = reader.decode(bitmap);
            const text = result?.getText()?.trim();
            if (!text) return null;
            const fmt = result.getBarcodeFormat();
            return { text, format: String(fmt), decoder: "zxing" };
          } catch {
            try {
              const inverted = new zxing.BinaryBitmap(new zxing.HybridBinarizer(luminance.invert()));
              const result = reader.decode(inverted);
              const text = result?.getText()?.trim();
              if (!text) return null;
              return { text, format: String(result.getBarcodeFormat()), decoder: "zxing" };
            } catch {
              return null;
            }
          } finally {
            reader.reset();
          }
        },
      };
    }
    return await zxingReader.decodeFromCanvas(canvas);
  } catch {
    zxingFailed = true;
    zxingReader = null;
    return null;
  }
}

export type DecodeOptions = {
  /** When false, skip BarcodeDetector (used to test the Safari fallback path). */
  allowBarcodeDetector?: boolean;
  /** Pre-fetched native formats; fetched automatically if omitted. */
  detectorFormats?: ScanFormat[];
};

/**
 * Decode one canvas frame. QR is attempted with jsQR even when
 * BarcodeDetector is absent or does not list qr_code (typical on iOS Safari).
 */
export async function decodeCanvas(
  canvas: HTMLCanvasElement,
  want: ScanFormat[] = BATTERY_SCAN_FORMATS,
  opts: DecodeOptions = {},
): Promise<DecodeResult | null> {
  const allowDetector = opts.allowBarcodeDetector !== false;
  const supported = opts.detectorFormats ?? (allowDetector ? await nativeDetectorFormats() : []);
  const wantsQr = want.includes("qr_code");
  const wantsOther = want.some((f) => f !== "qr_code");

  if (allowDetector && supported.length) {
    const detected = await decodeWithDetector(canvas, want, supported);
    if (detected) return detected;
  }

  if (wantsQr) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr = decodeQrImageData(image.data, image.width, image.height);
      if (qr) return qr;
    }
  }

  if (wantsOther || wantsQr) {
    const zxing = await decodeWithZxing(canvas, want);
    if (zxing) return zxing;
  }
  return null;
}
