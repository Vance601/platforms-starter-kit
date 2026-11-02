// Fixed-window counter in public_rate_limits (created on first use).
// Returns true when the caller is OVER the limit.
import { sql } from "@vercel/postgres";

let ready: Promise<unknown> | null = null;
function ensure() {
  if (!ready) {
    ready = sql`CREATE TABLE IF NOT EXISTS public_rate_limits (
      key TEXT NOT NULL,
      window_start TIMESTAMPTZ NOT NULL,
      hits INT NOT NULL DEFAULT 0,
      PRIMARY KEY (key, window_start)
    )`.catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export async function overLimit(key: string, windowMin: number, max: number): Promise<boolean> {
  await ensure();
  const { rows } = await sql`
    INSERT INTO public_rate_limits (key, window_start, hits)
    VALUES (${key}, date_bin(${windowMin + " minutes"}::interval, now(), 'epoch'::timestamptz), 1)
    ON CONFLICT (key, window_start) DO UPDATE SET hits = public_rate_limits.hits + 1
    RETURNING hits`;
  return Number(rows[0]?.hits) > max;
}

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}
