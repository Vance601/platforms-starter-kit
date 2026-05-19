import { sql } from "@vercel/postgres";

const COMPANY_CODE_MAP: Record<string, string> = {
  "abq": "ABQ",
  "phx": "PHX",
  "tucson": "TUC",
};

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
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

  const dateStr = formatDate(date);
  const prefix = `DG-${companyCode}-${batteryModelCode}-${dateStr}-`;

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
