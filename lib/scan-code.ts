// Shared parsing for anything a driver (or staff) might scan off a Battery City
// label. The 3×2 battery QR and the truck windshield QR both encode a raw
// identifier (e.g. "DG-PHX-78-20261116-0001" or "DG-TRUCK-125"), not a URL,
// but phone cameras and some decoder libraries sometimes wrap or pad the
// payload. One helper so every scan page agrees on the same cleanup and match.

export type ScannableItem = {
  barcode?: string | null;
  serial_number?: string | null;
  serialNumber?: string | null;
};

/** Strip decoder noise without changing a valid barcode or VIN. */
export function normalizeScanText(raw: string): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  // Some scanners return a file:// or https:// URL with the code as the last path segment.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const fromQuery =
        u.searchParams.get("barcode") ||
        u.searchParams.get("code") ||
        u.searchParams.get("data") ||
        u.searchParams.get("id");
      const path = decodeURIComponent(u.pathname.replace(/\/+$/, "").split("/").pop() || "");
      s = (fromQuery || path || s).trim();
    } catch {
      // keep original
    }
  }
  s = s.replace(/^\uFEFF/, "").replace(/[\r\n\t]+/g, "").trim();
  // Common wrappers: quotes, brackets, trailing punctuation from a URL share.
  s = s.replace(/^['"<\(\[]+/, "").replace(/['">\)\],.;]+$/, "").trim();
  return s;
}

export function scanKey(raw: string): string {
  return normalizeScanText(raw).toUpperCase();
}

/** True if a scanned payload identifies this battery (barcode or serial). */
export function matchesScannedItem(item: ScannableItem, scanned: string): boolean {
  const needle = scanKey(scanned);
  if (!needle) return false;
  const barcode = scanKey(item.barcode || "");
  const serial = scanKey(item.serial_number || item.serialNumber || "");
  if (barcode && barcode === needle) return true;
  if (serial && serial === needle) return true;
  return false;
}

export function findScannedItem<T extends ScannableItem>(items: T[], scanned: string): T | undefined {
  return items.find((item) => matchesScannedItem(item, scanned));
}
