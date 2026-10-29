// Canonical battery classifications used across the app. The source of truth
// is the battery_types table (code column); this list is only a fallback /
// display ordering. Legacy rows and old UI code spelled AGM as "AMG" -- always
// run names through normalizeBatteryType() before displaying or grouping.
export const CANONICAL_BATTERY_TYPES = ["AGM", "Alpha", "Bravo", "Prius", "Tesla"] as const

const ALIASES: Record<string, string> = {
  amg: "AGM",
  agm: "AGM",
  alpha: "Alpha",
  bravo: "Bravo",
  prius: "Prius",
  tesla: "Tesla",
}

export function normalizeBatteryType(name: string | null | undefined): string {
  if (!name) return "Unknown"
  const trimmed = String(name).trim()
  return ALIASES[trimmed.toLowerCase()] ?? trimmed
}
