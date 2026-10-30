// VIN helpers: normalize, validate (ISO 3779 / North American check digit),
// and decode through the free NHTSA vPIC API with a DB cache.
import { sql } from "@vercel/postgres";
import { ensureSaleTables } from "@/lib/sale-records";

const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

// Door-jamb Code 39 VIN labels often carry a leading "I" (import) marker.
export function normalizeVin(raw: string): string {
  let v = (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (v.length === 18 && v.startsWith("I")) v = v.slice(1);
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

export type DecodedVin = {
  vin: string;
  year: string | null;
  make: string | null;
  model: string | null;
  engine: string | null;
};

const clean = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s && s !== "Not Applicable" && s !== "0" ? s : null;
};

export function engineLabel(r: Record<string, unknown>): string | null {
  const disp = clean(r.DisplacementL);
  const cyl = clean(r.EngineCylinders);
  const fuel = clean(r.FuelTypePrimary);
  const parts = [
    disp ? `${Number(disp).toFixed(1)}L` : null,
    cyl ? `${cyl}-cyl` : null,
    fuel && fuel !== "Gasoline" ? fuel : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : clean(r.EngineModel);
}

export async function decodeVin(vin: string): Promise<DecodedVin> {
  await ensureSaleTables();
  const { rows } = await sql`SELECT year, make, model, engine FROM vin_decode_cache WHERE vin = ${vin} LIMIT 1;`;
  if (rows[0]) return { vin, ...(rows[0] as Omit<DecodedVin, "vin">) };

  const res = await fetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
    { cache: "no-store", signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) throw new Error(`VIN lookup service error (${res.status}).`);
  const data = await res.json();
  const r = (data?.Results?.[0] ?? {}) as Record<string, unknown>;
  const out: DecodedVin = {
    vin,
    year: clean(r.ModelYear),
    make: clean(r.Make),
    model: clean(r.Model),
    engine: engineLabel(r),
  };
  if (out.make || out.model) {
    await sql`
      INSERT INTO vin_decode_cache (vin, year, make, model, engine, raw)
      VALUES (${vin}, ${out.year}, ${out.make}, ${out.model}, ${out.engine}, ${JSON.stringify(r)})
      ON CONFLICT (vin) DO NOTHING;
    `;
  }
  return out;
}
