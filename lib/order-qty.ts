// Reorder quantity rules: a positive whole number, up to a sanity cap.
export const MAX_ORDER_QTY = 10000;

/** Returns the quantity, or an error message for anything else (0, negatives, decimals, text). */
export function parseOrderQty(raw: unknown): { ok: true; qty: number } | { ok: false; error: string } {
  const s = String(raw ?? "").trim();
  if (!/^\d+$/.test(s)) return { ok: false, error: "Quantity must be a whole number of 1 or more." };
  const n = Number(s);
  if (n < 1) return { ok: false, error: "Quantity must be at least 1." };
  if (n > MAX_ORDER_QTY) return { ok: false, error: `Quantity can't be more than ${MAX_ORDER_QTY.toLocaleString()}.` };
  return { ok: true, qty: n };
}
