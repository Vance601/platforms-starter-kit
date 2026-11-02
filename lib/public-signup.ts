import { sql } from "@vercel/postgres";

// Pending self sign-ups awaiting email verification (additive, created on first use).
let ready: Promise<unknown> | null = null;
export function ensurePendingSignups() {
  if (!ready) {
    ready = sql`
      CREATE TABLE IF NOT EXISTS pending_signups (
        id            BIGSERIAL PRIMARY KEY,
        email         TEXT NOT NULL,
        token_hash    TEXT UNIQUE NOT NULL,
        payload       JSONB NOT NULL,
        ip            TEXT,
        expires_at    TIMESTAMPTZ NOT NULL,
        used_at       TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `.catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export function appBaseUrl(req: Request): string {
  const env = process.env.NEXTAUTH_URL || process.env.AUTH_URL;
  if (env) return env.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "www.battery-city.com";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}
