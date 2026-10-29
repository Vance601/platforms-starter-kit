// Shared bits for the emailed "Forgot password?" flow.
import { sql } from "@vercel/postgres";
import { createHash, randomBytes, scryptSync } from "crypto";

export const TOKEN_MINUTES = 30;

// Same scrypt "salt:hash" scheme verified by /api/auth-manager.
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

// Tokens are long random values, so a fast SHA-256 is enough for storage.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// One table, created on first use (additive only). Every request is logged,
// including unknown emails (user_id/token_hash NULL), so rate limits apply
// whether or not the email exists.
let ready: Promise<unknown> | null = null;
export function ensureResetTable() {
  if (!ready) {
    ready = sql`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id          BIGSERIAL PRIMARY KEY,
        user_id     TEXT,
        email       TEXT NOT NULL,
        ip          TEXT,
        token_hash  TEXT UNIQUE,
        expires_at  TIMESTAMPTZ,
        used_at     TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `.catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}
