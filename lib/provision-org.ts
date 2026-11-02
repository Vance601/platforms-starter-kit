// Shared org provisioning used by invite onboarding, public self sign-up and
// the demo. Additive only: inserts new rows, never touches existing orgs.
import { sql } from "@vercel/postgres";
import crypto from "crypto";
import { ensureOrgSettingsTable, type OrgSettings } from "@/lib/org-settings";

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "org"
  );
}

const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "d", "driver", "drivers", "login", "logout",
  "manager", "onboarding", "pending", "settings", "signup", "support",
  "team", "www", "new", "null", "undefined", "demo",
]);

// Clean slug when free, -2, -3 ... on collision. `table` is a fixed string.
export async function uniqueSlug(
  base: string,
  table: "organizations" | "companies" | "locations"
): Promise<string> {
  let candidate = base;
  if (RESERVED_SLUGS.has(candidate)) candidate = `${base}-1`;
  for (let attempt = 0; attempt < 25; attempt++) {
    let taken = false;
    if (table === "organizations") {
      const { rows } = await sql`SELECT 1 FROM organizations WHERE lower(slug) = ${candidate} LIMIT 1;`;
      taken = rows.length > 0;
    } else if (table === "companies") {
      const { rows } = await sql`SELECT 1 FROM companies WHERE lower(slug) = ${candidate} LIMIT 1;`;
      taken = rows.length > 0;
    } else {
      const { rows } = await sql`SELECT 1 FROM locations WHERE lower(slug) = ${candidate} LIMIT 1;`;
      taken = rows.length > 0;
    }
    if (!taken) return candidate;
    candidate = `${base}-${attempt + 2}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function ensureDemoColumns() {
  await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;`;
  await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS demo_expires_at TIMESTAMPTZ;`;
}

export type ProvisionInput = {
  orgName: string;
  companyName: string;
  legalEntity?: string;
  locationName: string;
  city?: string | null;
  state?: string | null;
  settings?: OrgSettings | null; // written to org_settings when given
  demoDays?: number; // marks the org is_demo with an expiry
};

export type Provisioned = {
  orgId: string;
  orgSlug: string;
  companyId: string;
  companySlug: string;
  locationId: string;
};

export async function provisionOrg(input: ProvisionInput): Promise<Provisioned> {
  const orgId = crypto.randomUUID();
  const orgSlug = await uniqueSlug(slugify(input.orgName), "organizations");
  if (input.demoDays) {
    await ensureDemoColumns();
    await sql`
      INSERT INTO organizations (id, name, slug, is_demo, demo_expires_at)
      VALUES (${orgId}, ${input.orgName}, ${orgSlug}, true, now() + make_interval(days => ${input.demoDays}));
    `;
  } else {
    await sql`INSERT INTO organizations (id, name, slug) VALUES (${orgId}, ${input.orgName}, ${orgSlug});`;
  }

  const companyId = crypto.randomUUID();
  const companySlug = await uniqueSlug(slugify(input.companyName), "companies");
  const legal = (input.legalEntity || "").trim() || input.companyName;
  await sql`
    INSERT INTO companies (id, org_id, slug, name, legal_entity, active)
    VALUES (${companyId}, ${orgId}, ${companySlug}, ${input.companyName}, ${legal}, true);
  `;

  const locationId = crypto.randomUUID();
  const locationSlug = await uniqueSlug(slugify(input.locationName), "locations");
  await sql`
    INSERT INTO locations (id, company_id, slug, name, city, state, active)
    VALUES (${locationId}, ${companyId}, ${locationSlug}, ${input.locationName},
            ${input.city || null}, ${input.state || null}, true);
  `;

  await seedBatteryTypes();

  if (input.settings) {
    await ensureOrgSettingsTable();
    const s = input.settings;
    await sql`
      INSERT INTO org_settings (org_id, barcode_prefix, timezone, core_charge, updated_at)
      VALUES (${orgId}, ${s.barcodePrefix}, ${s.timezone}, ${s.coreCharge}, now())
      ON CONFLICT (org_id) DO NOTHING;
    `;
  }

  return { orgId, orgSlug, companyId, companySlug, locationId };
}

// Make an existing user the owner of the org and link them to the company.
export async function makeOwner(userId: string, orgId: string, companyId: string) {
  await sql`UPDATE users SET org_id = ${orgId}, role = 'owner' WHERE id = ${userId};`;
  await sql`
    INSERT INTO user_companies (user_id, company_id) VALUES (${userId}, ${companyId})
    ON CONFLICT DO NOTHING;
  `;
}

// battery_types.code is globally unique: shared reference rows, created once.
export async function seedBatteryTypes() {
  const defaultTypes: Array<[string, string, string, string, number, number]> = [
    ["Alpha", "Standard flooded lead-acid", "85.00", "159.00", 20, 50],
    ["Bravo", "Mid-range maintenance-free", "105.00", "189.00", 40, 100],
    ["Charlie", "High-performance starting battery", "135.00", "229.00", 30, 60],
    ["AGM", "Absorbent Glass Mat - premium", "175.00", "289.00", 15, 30],
  ];
  for (const [code, desc, cost, price, parMin, parMax] of defaultTypes) {
    await sql`
      INSERT INTO battery_types
        (id, code, name, description, default_cost, default_price, par_level_min, par_level_max)
      VALUES (${crypto.randomUUID()}, ${code}, ${code}, ${desc}, ${cost}, ${price}, ${parMin}, ${parMax})
      ON CONFLICT (code) DO NOTHING;
    `;
  }
}
