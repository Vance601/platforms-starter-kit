// VIN helpers: normalize, validate (ISO 3779 / North American check digit),
// and decode through the free NHTSA vPIC API with a DB cache.
import { sql } from "@vercel/postgres";
import { ensureSaleTables } from "@/lib/sale-records";

import { normalizeVin, vinError } from "@/lib/vin-check";
export { normalizeVin, vinError, extractVin } from "@/lib/vin-check";

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
