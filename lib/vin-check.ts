// Pure VIN helpers, safe to import in client components (no DB imports).
const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

// Door-jamb / windshield Code 39 VIN labels often carry one extra leading
// character ("I" import marker, sometimes read as "Q" or "0").
export function normalizeVin(raw: string): string {
  let v = (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (v.length === 18 && /^[IQ0]/.test(v)) v = v.slice(1);
  return v;
}

export function vinError(vin: string): string | null {
  if (vin.length !== 17) return `A VIN has 17 characters (got ${vin.length}).`;
  if (/[IOQ]/.test(vin)) return "A VIN never contains I, O or Q. Check the characters.";
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const c = vin[i];
    const n = /[0-9]/.test(c) ? Number(c) : TRANSLIT[c];
    if (n === undefined) return "VIN has an invalid character.";
    sum += n * WEIGHTS[i];
  }
  const r = sum % 11;
  const expected = r === 10 ? "X" : String(r);
  if (vin[8] !== expected) return "VIN check digit doesn't match. Re-scan or re-type it.";
  return null;
}

// Pull a VIN with a valid check digit out of any scanned barcode payload.
// Handles plain Code 39/128 reads, 18-char reads with a leading I/Q/0, and
// QR / Data Matrix payloads that hold the VIN among other text or fields.
// Returns null when no check-digit-valid VIN is present (keep scanning).
export function extractVin(raw: string): string | null {
  const direct = normalizeVin(raw);
  if (!vinError(direct)) return direct;
  const up = (raw || "").toUpperCase();
  const tokens = up.split(/[^A-Z0-9]+/).filter((t) => t.length >= 17);
  for (const t of tokens) {
    const n = normalizeVin(t);
    if (!vinError(n)) return n;
    for (let i = 0; i + 17 <= t.length; i++) {
      const c = t.slice(i, i + 17);
      if (!vinError(c)) return c;
    }
  }
  return null;
}
