import { sql } from "@vercel/postgres";
import { getOrgSettingsForCompanySlug } from "@/lib/org-settings";

const COMPANY_CODE_MAP: Record<string, string> = {
  "abq": "ABQ",
  "phx": "PHX",
  "tucson": "TUC",
};

// Server runs in UTC (Vercel); after 5pm Phoenix time getDate() already
// returned tomorrow. Always stamp the business-local day (org timezone, default America/Phoenix).
function formatDate(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}`;
}

export async function generateNextBarcode(
  companySlug: string,
  batteryModelCode: string,
  date: Date = new Date()
): Promise<string> {
  const companyCode = COMPANY_CODE_MAP[companySlug];
  if (!companyCode) {
    throw new Error(`Unknown company slug: ${companySlug}`);
  }

  const { rows: modelRows } = await sql`
    SELECT code FROM battery_models WHERE code = ${batteryModelCode};
  `;
  if (modelRows.length === 0) {
    throw new Error(`Unknown battery model code: ${batteryModelCode}`);
  }

  const settings = await getOrgSettingsForCompanySlug(companySlug);
  const dateStr = formatDate(date, settings.timezone);
  const prefix = `${settings.barcodePrefix}-${companyCode}-${batteryModelCode}-${dateStr}-`;

  const { rows } = await sql`
    SELECT barcode FROM batteries
    WHERE barcode LIKE ${prefix + "%"}
    ORDER BY barcode DESC
    LIMIT 1;
  `;

  let nextSeq = 1;
  if (rows.length > 0) {
    const lastBarcode = rows[0].barcode as string;
    const lastSeqStr = lastBarcode.substring(prefix.length);
    const lastSeq = parseInt(lastSeqStr, 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  const seqStr = String(nextSeq).padStart(4, "0");
  return prefix + seqStr;
}
