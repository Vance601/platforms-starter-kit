/** Avoid titles like "Truck #Truck #123" when the stored number already includes a prefix. */
export function formatTruckLabel(truckNumber: string | null | undefined): string {
  const s = String(truckNumber ?? "").trim();
  if (!s) return "Truck";
  const core = s.replace(/^(?:trucks?\s*#\s*|#\s*)+/i, "").trim();
  return core ? `Truck #${core}` : "Truck";
}
