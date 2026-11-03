// Demo provisioning: an isolated, expiring org with fake data. Everything is
// created fresh under a new org id; nothing existing is read or changed.
import { sql } from "@vercel/postgres";
import { generateNextBarcode } from "@/lib/barcode";
import crypto from "crypto";
import { provisionOrg, makeOwner, ensureDemoColumns } from "@/lib/provision-org";
import { ensureSaleTables } from "@/lib/sale-records";

export const DEMO_DAYS = 7;
export const DEMO_TIMEZONE = "America/Los_Angeles";

let ready: Promise<unknown> | null = null;
export function ensureDemoTables() {
  if (!ready) {
    ready = (async () => {
      await ensureDemoColumns();
      await sql`
        CREATE TABLE IF NOT EXISTS demo_orgs (
          org_id        TEXT PRIMARY KEY,
          owner_user_id TEXT NOT NULL,
          company_slug  TEXT NOT NULL,
          driver_name   TEXT NOT NULL,
          driver_pin    TEXT NOT NULL,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        );`;
      await sql`ALTER TABLE demo_orgs ADD COLUMN IF NOT EXISTS creator_ip TEXT`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

// Is this org a demo? Cheap, defensive (false if the column doesn't exist yet).
export async function isDemoOrg(orgId: string | null | undefined): Promise<boolean> {
  if (!orgId) return false;
  try {
    const { rows } = await sql`SELECT is_demo FROM organizations WHERE id = ${String(orgId)} LIMIT 1;`;
    return rows[0]?.is_demo === true;
  } catch {
    return false;
  }
}

function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(pin, salt, 64).toString("hex")}`;
}

const DRIVERS = ["Alex Rivera", "Jordan Brooks", "Sam Okafor"]; // fictional
const CUSTOMERS: [string, string, string, string, string][] = [
  // name, phone, vin, year make, model
  ["Maria Lopez", "(702) 555-0141", "1HGCM82633A004352", "2018 Honda", "Accord"],
  ["Devin Carter", "(702) 555-0187", "1FTFW1ET5DFC10312", "2013 Ford", "F-150"],
  ["Priya Shah", "(725) 555-0123", "5YJ3E1EA7KF317000", "2019 Tesla", "Model 3"],
  ["Tom Nguyen", "(702) 555-0199", "2T1BURHE0JC074534", "2018 Toyota", "Corolla"],
  ["Rachel Kim", "(725) 555-0156", "1C4RJFAG5FC625797", "2015 Jeep", "Grand Cherokee"],
  ["Luis Ortega", "(702) 555-0172", "3GCUKREC8EG123456", "2014 Chevrolet", "Silverado"],
];

export type DemoResult = { orgId: string; userId: string; companySlug: string; driverName: string; driverPin: string };

export async function createDemoOrg(creatorIp: string | null = null): Promise<DemoResult> {
  await ensureDemoTables();
  const tag = crypto.randomBytes(3).toString("hex");
  const org = await provisionOrg({
    orgName: `Desert Sun Roadside Demo ${tag}`,
    companyName: `Desert Sun Roadside ${tag}`,
    legalEntity: "Desert Sun Roadside (demo)",
    locationName: "Las Vegas Warehouse",
    city: "Las Vegas",
    state: "NV",
    settings: { barcodePrefix: "LV", timezone: DEMO_TIMEZONE, coreCharge: 25 },
    demoDays: DEMO_DAYS,
  });

  // Owner user: no password (one-click demo session only), fake inbox domain.
  const userId = crypto.randomUUID();
  await sql`
    INSERT INTO users (id, name, email, role, status)
    VALUES (${userId}, 'Demo Owner', ${`demo-${tag}-${userId.slice(0, 8)}@demo.invalid`}, 'owner', 'active');
  `;
  await makeOwner(userId, org.orgId, org.companyId);

  const driverPin = String(crypto.randomInt(1000, 10000));
  const driverIds: string[] = [];
  for (let i = 0; i < DRIVERS.length; i++) {
    const { rows } = await sql`
      INSERT INTO drivers (id, name, phone, company_id, pin_hash, active, created_at, updated_at)
      VALUES (gen_random_uuid(), ${DRIVERS[i]}, ${`(702) 555-01${10 + i}`}, ${org.companyId},
              ${hashPin(driverPin)}, true, now(), now())
      RETURNING id;`;
    driverIds.push(String(rows[0].id));
  }

  const truckIds: string[] = [];
  for (const [num, ym, vin5] of [["LV-101", "2021 Ford F-450", "A1021"], ["LV-102", "2019 Ram 5500", "B2019"], ["LV-103", "2022 Chevy 4500", "C3022"]]) {
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO trucks (id, truck_number, year_model, vin_last5, company_id, active, created_at, updated_at)
      VALUES (${id}, ${num}, ${ym}, ${vin5}, ${org.companyId}, true, now(), now());`;
    truckIds.push(id);
  }

  await seedBatteriesAndSales(org, tag, truckIds, driverIds).catch((e) =>
    console.error("[demo] battery/sales seed incomplete", e)
  );

  await ensureDemoDeliveries(org.orgId).catch((e) => console.error("[demo] delivery seed", e));

  await sql`
    INSERT INTO demo_orgs (org_id, owner_user_id, company_slug, driver_name, driver_pin, creator_ip)
    VALUES (${org.orgId}, ${userId}, ${org.companySlug}, ${DRIVERS[0]}, ${driverPin}, ${creatorIp});`;

  return { orgId: org.orgId, userId, companySlug: org.companySlug, driverName: DRIVERS[0], driverPin };
}

async function seedBatteriesAndSales(
  org: { orgId: string; companyId: string; locationId: string; companySlug: string },
  tag: string,
  truckIds: string[],
  driverIds: string[]
) {
  const { rows: models } = await sql`
    SELECT bm.id AS model_id, bm.code AS code, bm.battery_type_id AS type_id
    FROM battery_models bm
    WHERE bm.battery_type_id IS NOT NULL
    ORDER BY bm.code
    LIMIT 6;`;
  if (models.length === 0) return;

  await ensureSaleTables();
  let n = 0;
  const make = async (status: "in_warehouse" | "on_truck" | "sold", truckId: string | null) => {
    n++;
    const m = models[n % models.length];
    const id = crypto.randomUUID();
    // Same format as batteries added or received later (per-org prefix, company, model, date, seq).
    const barcode = await generateNextBarcode(org.companySlug, String(m.code), new Date(Date.now() - 10 * 86400000));
    await sql`
      INSERT INTO batteries (id, barcode, battery_type_id, battery_model_id, company_id, location_id,
                             status, cost, received_at, created_at)
      VALUES (${id}, ${barcode}, ${m.type_id}, ${m.model_id}, ${org.companyId}, ${org.locationId},
              'in_warehouse', 95, now() - interval '10 days', now() - interval '10 days');`;
    await sql`
      INSERT INTO battery_movements (id, battery_id, from_status, to_status, to_location_id, occurred_at, notes)
      VALUES (${crypto.randomUUID()}, ${id}, NULL, 'in_warehouse', ${org.locationId}, now() - interval '10 days', 'Demo stock received');`;
    if (status !== "in_warehouse" && truckId) {
      await sql`UPDATE batteries SET status = 'on_truck', truck_id = ${truckId}, current_truck_id = ${truckId} WHERE id = ${id};`;
      await sql`
        INSERT INTO battery_movements (id, battery_id, from_status, to_status, to_truck_id, driver_id, occurred_at, notes)
        VALUES (${crypto.randomUUID()}, ${id}, 'in_warehouse', 'on_truck', ${truckId}, ${driverIds[0]}, now() - interval '7 days', 'Demo load');`;
    }
    return { id, code: String(m.code) };
  };

  for (let i = 0; i < 12; i++) await make("in_warehouse", null);
  for (let i = 0; i < 9; i++) await make("on_truck", truckIds[i % truckIds.length]);

  for (let i = 0; i < CUSTOMERS.length; i++) {
    const truckId = truckIds[i % truckIds.length];
    const driverId = driverIds[i % driverIds.length];
    const b = await make("on_truck", truckId);
    const [name, phone, vin, yearMake, model] = CUSTOMERS[i];
    const [year, ...mk] = yearMake.split(" ");
    const call = `DEMO-${1000 + i}`;
    const daysAgo = 1 + i * 4;
    await sql`
      UPDATE batteries SET status = 'sold', sold_at = now() - make_interval(days => ${daysAgo}),
             sold_on_call_number = ${call}, truck_id = NULL, current_truck_id = NULL
      WHERE id = ${b.id};`;
    const movementId = crypto.randomUUID();
    await sql`
      INSERT INTO battery_movements (id, battery_id, from_status, to_status, from_truck_id, driver_id, call_reference, occurred_at, notes)
      VALUES (${movementId}, ${b.id}, 'on_truck', 'sold', ${truckId}, ${driverId}, ${call},
              now() - make_interval(days => ${daysAgo}), 'Demo sale');`;
    await sql`
      INSERT INTO core_returns (id, battery_id, company_id, location_id, status, deposit_amount, notes)
      VALUES (${crypto.randomUUID()}, ${b.id}, ${org.companyId}, ${org.locationId},
              ${i % 3 === 0 ? "customer_kept" : "owed"}, 25, 'Demo core');`.catch(() => {});
    const customerId = crypto.randomUUID();
    await sql`
      INSERT INTO customers (id, org_id, company_id, name, phone, phone_digits)
      VALUES (${customerId}, ${org.orgId}, ${org.companyId}, ${name}, ${phone}, ${phone.replace(/\D/g, "")});`;
    const vehicleId = crypto.randomUUID();
    await sql`
      INSERT INTO vehicles (id, org_id, company_id, vin, year, make, model, customer_id)
      VALUES (${vehicleId}, ${org.orgId}, ${org.companyId}, ${vin}, ${year}, ${mk.join(" ")}, ${model}, ${customerId});`;
    await sql`
      INSERT INTO sale_records (id, org_id, company_id, battery_id, movement_id, driver_id, call_number,
                                customer_id, vehicle_id, vin, battery_group, is_warranty_install,
                                warranty_start, warranty_months, warranty_end, created_at)
      VALUES (${crypto.randomUUID()}, ${org.orgId}, ${org.companyId}, ${b.id}, ${movementId}, ${driverId}, ${call},
              ${customerId}, ${vehicleId}, ${vin}, ${b.code}, false,
              (now() - make_interval(days => ${daysAgo}))::date, 36,
              ((now() - make_interval(days => ${daysAgo}))::date + interval '36 months')::date,
              now() - make_interval(days => ${daysAgo}));`;
  }
}

// Owner user id of a live (non-expired) demo org, or null.
export async function liveDemoOwner(where: { userId?: string; ip?: string }): Promise<string | null> {
  await ensureDemoTables();
  if (where.userId) {
    const { rows } = await sql`
      SELECT d.owner_user_id FROM demo_orgs d JOIN organizations o ON o.id::text = d.org_id
      WHERE d.owner_user_id = ${where.userId} AND o.is_demo = true AND o.demo_expires_at > now() LIMIT 1`;
    return rows[0]?.owner_user_id ?? null;
  }
  if (where.ip) {
    const { rows } = await sql`
      SELECT d.owner_user_id FROM demo_orgs d JOIN organizations o ON o.id::text = d.org_id
      WHERE d.creator_ip = ${where.ip} AND o.is_demo = true AND o.demo_expires_at > now()
      ORDER BY d.created_at DESC LIMIT 1`;
    return rows[0]?.owner_user_id ?? null;
  }
  return null;
}

// Demo orgs only: give unlabelled demo stock a sample delivery receipt so
// Print Labels has something to show. Idempotent; also backfills older demos.
export async function ensureDemoDeliveries(orgId: string): Promise<void> {
  if (!(await isDemoOrg(orgId))) return;
  const { rows: cos } = await sql`
    SELECT c.id AS company_id, (SELECT l.id FROM locations l WHERE l.company_id = c.id ORDER BY l.created_at LIMIT 1) AS location_id
    FROM companies c WHERE c.org_id = ${orgId}`;
  for (const c of cos) {
    const { rows: have } = await sql`SELECT 1 FROM delivery_receipts WHERE company_id = ${c.company_id} LIMIT 1`;
    if (have.length) continue;
    const { rows: cnt } = await sql`
      SELECT count(*)::int AS n FROM batteries WHERE company_id = ${c.company_id} AND delivery_receipt_id IS NULL`;
    if (!cnt[0]?.n) continue;
    const receiptId = crypto.randomUUID();
    await sql`
      INSERT INTO delivery_receipts (id, company_id, location_id, supplier, receipt_number, receipt_date,
                                     total_units, core_charges, notes)
      VALUES (${receiptId}, ${c.company_id}, ${c.location_id}, 'Desert Battery Supply (demo)', 'DEMO-RCV-1001',
              now() - interval '10 days', ${cnt[0].n}, 0, 'Sample delivery for the demo');`;
    await sql`
      UPDATE batteries SET delivery_receipt_id = ${receiptId}
      WHERE company_id = ${c.company_id} AND delivery_receipt_id IS NULL`;
  }
}
