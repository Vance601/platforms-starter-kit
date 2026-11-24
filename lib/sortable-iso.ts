/** Postgres / neon often returns timestamptz columns as Date, not string. */
export function toSortableIso(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString();
  const d = new Date(v as string | number);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}
