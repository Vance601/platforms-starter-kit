// Per-organization settings (barcode prefix, business timezone, default core
// charge, and label print offset). Stored in one additive table created on
// first use; an org with no row gets the defaults below, which match the
// original Duggers behaviour, so existing data and labels are unchanged.
import { sql } from "@vercel/postgres";

export type OrgSettings = {
  barcodePrefix: string;
  timezone: string;
  coreCharge: number;
  /** Inches to the right (negative = left). */
  labelOffsetXIn: number;
  /** Inches up (negative = down). */
  labelOffsetYIn: number;
};

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  barcodePrefix: "DG",
  timezone: "America/Phoenix",
  coreCharge: 25,
  labelOffsetXIn: 0,
  labelOffsetYIn: 0,
};

const OFFSET_MIN = -1;
const OFFSET_MAX = 1;

export function clampLabelOffsetInches(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(OFFSET_MIN, Math.min(OFFSET_MAX, n)) * 100) / 100;
}

function offsetFromRow(raw: unknown): number {
  return clampLabelOffsetInches(Number(raw));
}

let ready: Promise<unknown> | null = null;
export function ensureOrgSettingsTable() {
  if (!ready) {
    ready = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS org_settings (
          org_id          TEXT PRIMARY KEY,
          barcode_prefix  TEXT NOT NULL DEFAULT 'DG',
          timezone        TEXT NOT NULL DEFAULT 'America/Phoenix',
          core_charge     NUMERIC(10,2) NOT NULL DEFAULT 25,
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `;
      await sql`ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS label_offset_x_in NUMERIC(6,3) NOT NULL DEFAULT 0;`;
      await sql`ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS label_offset_y_in NUMERIC(6,3) NOT NULL DEFAULT 0;`;
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function getOrgSettings(orgId: string | number | null | undefined): Promise<OrgSettings> {
  if (orgId === null || orgId === undefined || orgId === "") return { ...DEFAULT_ORG_SETTINGS };
  try {
    await ensureOrgSettingsTable();
    const { rows } = await sql`
      SELECT barcode_prefix, timezone, core_charge, label_offset_x_in, label_offset_y_in
      FROM org_settings WHERE org_id = ${String(orgId)} LIMIT 1;
    `;
    if (rows.length === 0) return { ...DEFAULT_ORG_SETTINGS };
    const r = rows[0];
    return {
      barcodePrefix: (r.barcode_prefix as string) || DEFAULT_ORG_SETTINGS.barcodePrefix,
      timezone: isValidTimezone(r.timezone as string) ? (r.timezone as string) : DEFAULT_ORG_SETTINGS.timezone,
      coreCharge: Number(r.core_charge) || DEFAULT_ORG_SETTINGS.coreCharge,
      labelOffsetXIn: offsetFromRow(r.label_offset_x_in),
      labelOffsetYIn: offsetFromRow(r.label_offset_y_in),
    };
  } catch {
    // Never break a page or a sale over settings; fall back to defaults.
    return { ...DEFAULT_ORG_SETTINGS };
  }
}

export async function getOrgSettingsForCompanySlug(slug: string): Promise<OrgSettings> {
  try {
    const { rows } = await sql`SELECT org_id FROM companies WHERE slug = ${slug} LIMIT 1;`;
    return getOrgSettings(rows[0]?.org_id ?? null);
  } catch {
    return { ...DEFAULT_ORG_SETTINGS };
  }
}

export function validateSettingsInput(
  body: any,
): { ok: true; value: OrgSettings; offsetsProvided: boolean } | { ok: false; error: string } {
  const prefix = String(body?.barcodePrefix ?? "").trim().toUpperCase();
  const tz = String(body?.timezone ?? "").trim();
  const charge = Number(body?.coreCharge);
  if (!/^[A-Z0-9]{1,6}$/.test(prefix)) return { ok: false, error: "Barcode prefix must be 1-6 letters/numbers." };
  if (!isValidTimezone(tz)) return { ok: false, error: "Unknown timezone." };
  if (!Number.isFinite(charge) || charge < 0 || charge > 10000) return { ok: false, error: "Core charge must be 0-10000." };
  const offsetsProvided =
    body != null &&
    typeof body === "object" &&
    ("labelOffsetXIn" in body || "labelOffsetYIn" in body || "xIn" in body || "yIn" in body);
  const labelOffsetXIn = offsetsProvided
    ? clampLabelOffsetInches(Number(body.labelOffsetXIn ?? body.xIn ?? 0))
    : DEFAULT_ORG_SETTINGS.labelOffsetXIn;
  const labelOffsetYIn = offsetsProvided
    ? clampLabelOffsetInches(Number(body.labelOffsetYIn ?? body.yIn ?? 0))
    : DEFAULT_ORG_SETTINGS.labelOffsetYIn;
  return {
    ok: true,
    value: { barcodePrefix: prefix, timezone: tz, coreCharge: charge, labelOffsetXIn, labelOffsetYIn },
    offsetsProvided,
  };
}

export function validateLabelOffsetInput(
  body: any,
): { ok: true; xIn: number; yIn: number } | { ok: false; error: string } {
  const xRaw = body?.xIn ?? body?.labelOffsetXIn;
  const yRaw = body?.yIn ?? body?.labelOffsetYIn;
  if (xRaw === undefined || yRaw === undefined || xRaw === null || yRaw === null || xRaw === "" || yRaw === "") {
    return { ok: false, error: "Both left/right and up/down offsets are required." };
  }
  const xIn = Number(xRaw);
  const yIn = Number(yRaw);
  if (!Number.isFinite(xIn) || !Number.isFinite(yIn)) {
    return { ok: false, error: "Offsets must be numbers, in inches." };
  }
  if (xIn < OFFSET_MIN || xIn > OFFSET_MAX || yIn < OFFSET_MIN || yIn > OFFSET_MAX) {
    return { ok: false, error: "Offsets must be between -1.00 and 1.00 inches." };
  }
  return { ok: true, xIn: clampLabelOffsetInches(xIn), yIn: clampLabelOffsetInches(yIn) };
}
