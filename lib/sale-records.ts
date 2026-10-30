// Customer / vehicle / warranty records attached to a sale (VIN-first flow).
// All tables are additive and created on first use. Nothing here alters or
// deletes existing rows in batteries, core_returns or battery_movements.
import { sql } from "@vercel/postgres";
import crypto from "crypto";

export const DEFAULT_WARRANTY_MONTHS = 36;
export const WARRANTY_TERMS = [12, 24, 36, 48, 60];

let ready: Promise<unknown> | null = null;
export function ensureSaleTables() {
  if (!ready) {
    ready = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS vin_decode_cache (
          vin        TEXT PRIMARY KEY,
          year       TEXT,
          make       TEXT,
          model      TEXT,
          engine     TEXT,
          raw        JSONB,
          fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );`;
      await sql`
        CREATE TABLE IF NOT EXISTS customers (
          id           TEXT PRIMARY KEY,
          org_id       TEXT,
          company_id   TEXT,
          name         TEXT NOT NULL,
          phone        TEXT NOT NULL,
          phone_digits TEXT NOT NULL,
          email        TEXT,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        );`;
      await sql`CREATE INDEX IF NOT EXISTS customers_org_phone_idx ON customers (org_id, phone_digits);`;
      await sql`
        CREATE TABLE IF NOT EXISTS vehicles (
          id          TEXT PRIMARY KEY,
          org_id      TEXT,
          company_id  TEXT,
          vin         TEXT NOT NULL,
          year        TEXT,
          make        TEXT,
          model       TEXT,
          engine      TEXT,
          customer_id TEXT,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );`;
      await sql`CREATE INDEX IF NOT EXISTS vehicles_org_vin_idx ON vehicles (org_id, vin);`;
      await sql`
        CREATE TABLE IF NOT EXISTS sale_records (
          id                    TEXT PRIMARY KEY,
          org_id                TEXT,
          company_id            TEXT,
          battery_id            TEXT NOT NULL,
          movement_id           TEXT,
          driver_id             TEXT,
          call_number           TEXT,
          customer_id           TEXT,
          vehicle_id            TEXT,
          vin                   TEXT,
          battery_group         TEXT,
          recommended_group     TEXT,
          recommendation_source TEXT,
          is_warranty_install   BOOLEAN NOT NULL DEFAULT false,
          warranty_start        DATE NOT NULL,
          warranty_months       INT NOT NULL,
          warranty_end          DATE NOT NULL,
          created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
        );`;
      await sql`CREATE INDEX IF NOT EXISTS sale_records_org_vin_idx ON sale_records (org_id, vin);`;
      await sql`CREATE INDEX IF NOT EXISTS sale_records_customer_idx ON sale_records (customer_id);`;
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

export const phoneDigits = (p: string) => {
  const d = (p || "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
};

export type SaleCustomerInput = {
  vin: string;
  year: string | null;
  make: string | null;
  model: string | null;
  engine: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  batteryGroup: string | null;
  recommendedGroup: string | null;
  recommendationSource: string | null;
  warrantyMonths: number;
};

// Validates the optional VIN/customer block of a sale request. Returns an
// error string, or the parsed input (null when the old path is used).
export function parseSaleCustomer(body: Record<string, unknown>): string | SaleCustomerInput | null {
  const v = body?.vehicleSale as Record<string, unknown> | undefined;
  if (!v || typeof v !== "object") return null;
  const str = (x: unknown, max = 200) => (typeof x === "string" ? x.trim().slice(0, max) : "");
  const vin = str(v.vin, 17).toUpperCase();
  const name = str(v.customerName, 120);
  const phone = str(v.customerPhone, 40);
  const email = str(v.customerEmail, 200) || null;
  if (vin.length !== 17) return "The VIN is missing. Scan the VIN again.";
  if (!name) return "Enter the customer's name.";
  const digits = phoneDigits(phone);
  if (digits.length !== 10) return "Enter a 10-digit customer phone number.";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "That email address doesn't look right.";
  const months = Number(v.warrantyMonths) || DEFAULT_WARRANTY_MONTHS;
  if (!WARRANTY_TERMS.includes(months)) return "Pick a warranty term.";
  return {
    vin,
    year: str(v.year, 10) || null,
    make: str(v.make, 60) || null,
    model: str(v.model, 80) || null,
    engine: str(v.engine, 80) || null,
    customerName: name,
    customerPhone: phone,
    customerEmail: email,
    batteryGroup: str(v.batteryGroup, 20) || null,
    recommendedGroup: str(v.recommendedGroup, 20) || null,
    recommendationSource: str(v.recommendationSource, 20) || null,
    warrantyMonths: months,
  };
}

export async function writeSaleRecord(args: {
  input: SaleCustomerInput;
  orgId: string | null;
  companyId: string;
  batteryId: string;
  movementId: string;
  driverId: string;
  callNumber: string;
  isWarranty: boolean;
  timeZone: string;
}) {
  await ensureSaleTables();
  const { input: i, orgId, companyId } = args;
  const digits = phoneDigits(i.customerPhone);

  // Customer: reuse the org's record for this phone number, refresh name/email.
  const { rows: cust } = await sql`
    SELECT id FROM customers WHERE org_id IS NOT DISTINCT FROM ${orgId} AND phone_digits = ${digits}
    ORDER BY created_at LIMIT 1;`;
  let customerId: string = cust[0]?.id;
  if (customerId) {
    await sql`UPDATE customers SET name = ${i.customerName}, email = COALESCE(${i.customerEmail}, email), updated_at = now() WHERE id = ${customerId};`;
  } else {
    customerId = crypto.randomUUID();
    await sql`
      INSERT INTO customers (id, org_id, company_id, name, phone, phone_digits, email)
      VALUES (${customerId}, ${orgId}, ${companyId}, ${i.customerName}, ${i.customerPhone}, ${digits}, ${i.customerEmail});`;
  }

  // Vehicle: one row per org + VIN, pointing at the latest customer.
  const { rows: veh } = await sql`
    SELECT id FROM vehicles WHERE org_id IS NOT DISTINCT FROM ${orgId} AND vin = ${i.vin} ORDER BY created_at LIMIT 1;`;
  let vehicleId: string = veh[0]?.id;
  if (vehicleId) {
    await sql`UPDATE vehicles SET customer_id = ${customerId}, updated_at = now() WHERE id = ${vehicleId};`;
  } else {
    vehicleId = crypto.randomUUID();
    await sql`
      INSERT INTO vehicles (id, org_id, company_id, vin, year, make, model, engine, customer_id)
      VALUES (${vehicleId}, ${orgId}, ${companyId}, ${i.vin}, ${i.year}, ${i.make}, ${i.model}, ${i.engine}, ${customerId});`;
  }

  // Warranty starts on the business-local install day.
  const start = new Intl.DateTimeFormat("en-CA", { timeZone: args.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const id = crypto.randomUUID();
  const { rows } = await sql`
    INSERT INTO sale_records
      (id, org_id, company_id, battery_id, movement_id, driver_id, call_number, customer_id, vehicle_id,
       vin, battery_group, recommended_group, recommendation_source, is_warranty_install,
       warranty_start, warranty_months, warranty_end)
    VALUES
      (${id}, ${orgId}, ${companyId}, ${args.batteryId}, ${args.movementId}, ${args.driverId}, ${args.callNumber},
       ${customerId}, ${vehicleId}, ${i.vin}, ${i.batteryGroup}, ${i.recommendedGroup}, ${i.recommendationSource},
       ${args.isWarranty}, ${start}::date, ${i.warrantyMonths},
       (${start}::date + make_interval(months => ${i.warrantyMonths}))::date)
    RETURNING warranty_start::text AS warranty_start, warranty_end::text AS warranty_end;`;
  return { saleRecordId: id, customerId, vehicleId, warrantyStart: rows[0]?.warranty_start, warrantyEnd: rows[0]?.warranty_end };
}
