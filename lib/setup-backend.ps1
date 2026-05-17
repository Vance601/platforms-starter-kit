# ============================================================
# Dugger's Ops - Backend File Setup Script
# ============================================================
# This script creates all 9 backend files needed for Phase 1.
# Run from your project root: ~/Documents/Code/platforms-starter-kit
#
# Usage:
#   1. Open PowerShell
#   2. cd ~/Documents/Code/platforms-starter-kit
#   3. .\setup-backend.ps1
# ============================================================

Write-Host ""
Write-Host "Dugger's Ops Backend Setup" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

# Verify we're in the right folder
if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: package.json not found in current folder." -ForegroundColor Red
    Write-Host "You're in: $(Get-Location)" -ForegroundColor Yellow
    Write-Host "Run this from your project root (the folder with package.json)." -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Found package.json - we're in the right folder" -ForegroundColor Green
Write-Host ""

# Create folders
Write-Host "Creating folder structure..." -ForegroundColor Cyan
$folders = @(
    "lib\db",
    "app\api\auth\[...nextauth]",
    "app\api\migrate",
    "app\api\seed",
    "app\api\make-owner"
)
foreach ($folder in $folders) {
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
        Write-Host "  Created: $folder" -ForegroundColor Gray
    } else {
        Write-Host "  Exists:  $folder" -ForegroundColor DarkGray
    }
}
Write-Host ""

# Delete existing schema.ts if it exists (we're replacing it)
if (Test-Path "lib\db\schema.ts") {
    Remove-Item "lib\db\schema.ts" -Force
    Write-Host "[CLEAN] Removed old schema.ts" -ForegroundColor Yellow
    Write-Host ""
}

# ============================================================
# FILE 1: lib/db/schema.ts
# ============================================================
$schema = @'
import {
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  primaryKey,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { AdapterAccount } from "next-auth/adapters";

export const userRoleEnum = pgEnum("user_role", ["owner", "manager", "dispatcher", "driver"]);
export const userStatusEnum = pgEnum("user_status", ["active", "inactive", "terminated"]);
export const batteryStatusEnum = pgEnum("battery_status", ["in_warehouse", "on_truck", "sold", "returned_core", "missing", "damaged"]);
export const truckStatusEnum = pgEnum("truck_status", ["active", "in_maintenance", "out_of_service"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["pending_verification", "verified", "discrepancy", "reconciled"]);

export const companies = pgTable("companies", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  legalEntity: text("legal_entity").notNull(),
  quickbooksRealmId: text("quickbooks_realm_id"),
  towbookAccountId: text("towbook_account_id"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const locations = pgTable("locations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  companySlugIdx: uniqueIndex("location_company_slug_idx").on(t.companyId, t.slug),
}));

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  role: userRoleEnum("role").default("driver").notNull(),
  status: userStatusEnum("status").default("active").notNull(),
  homeLocationId: text("home_location_id").references(() => locations.id),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userCompanies = pgTable("user_companies", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.companyId] }),
}));

export const accounts = pgTable("accounts", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<AdapterAccount["type"]>().notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (t) => ({
  pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
}));

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.identifier, t.token] }),
}));

export const batteryTypes = pgTable("battery_types", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  defaultCost: numeric("default_cost", { precision: 10, scale: 2 }),
  defaultPrice: numeric("default_price", { precision: 10, scale: 2 }),
  parLevelMin: integer("par_level_min").default(10),
  parLevelMax: integer("par_level_max").default(50),
});

export const trucks = pgTable("trucks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  locationId: text("location_id").notNull().references(() => locations.id),
  fleetNumber: text("fleet_number").notNull(),
  make: text("make"),
  model: text("model"),
  year: integer("year"),
  license: text("license"),
  status: truckStatusEnum("status").default("active").notNull(),
  assignedDriverId: text("assigned_driver_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const batteries = pgTable("batteries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  barcode: text("barcode").notNull().unique(),
  serialNumber: text("serial_number"),
  batteryTypeId: text("battery_type_id").notNull().references(() => batteryTypes.id),
  companyId: text("company_id").notNull().references(() => companies.id),
  locationId: text("location_id").notNull().references(() => locations.id),
  currentTruckId: text("current_truck_id").references(() => trucks.id),
  currentDriverId: text("current_driver_id").references(() => users.id),
  status: batteryStatusEnum("status").default("in_warehouse").notNull(),
  cost: numeric("cost", { precision: 10, scale: 2 }),
  mbsInvoiceId: text("mbs_invoice_id"),
  receivedAt: timestamp("received_at"),
  soldAt: timestamp("sold_at"),
  soldById: text("sold_by_id").references(() => users.id),
  soldOnCallNumber: text("sold_on_call_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  companyIdx: index("battery_company_idx").on(t.companyId),
  locationIdx: index("battery_location_idx").on(t.locationId),
  statusIdx: index("battery_status_idx").on(t.status),
}));

export const batteryMovements = pgTable("battery_movements", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  batteryId: text("battery_id").notNull().references(() => batteries.id, { onDelete: "cascade" }),
  fromStatus: batteryStatusEnum("from_status"),
  toStatus: batteryStatusEnum("to_status").notNull(),
  fromLocationId: text("from_location_id").references(() => locations.id),
  toLocationId: text("to_location_id").references(() => locations.id),
  fromDriverId: text("from_driver_id").references(() => users.id),
  toDriverId: text("to_driver_id").references(() => users.id),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  recordedById: text("recorded_by_id").references(() => users.id),
  notes: text("notes"),
});

export const mbsInvoices = pgTable("mbs_invoices", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  invoiceNumber: text("invoice_number").notNull().unique(),
  companyId: text("company_id").notNull().references(() => companies.id),
  locationId: text("location_id").notNull().references(() => locations.id),
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  batteryCount: integer("battery_count").notNull(),
  status: invoiceStatusEnum("status").default("pending_verification").notNull(),
  rawText: text("raw_text"),
  fileUrl: text("file_url"),
  uploadedById: text("uploaded_by_id").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  verifiedAt: timestamp("verified_at"),
  verifiedById: text("verified_by_id").references(() => users.id),
});

export const sales = pgTable("sales", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id),
  locationId: text("location_id").notNull().references(() => locations.id),
  batteryId: text("battery_id").notNull().references(() => batteries.id),
  driverId: text("driver_id").notNull().references(() => users.id),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  towbookCallNumber: text("towbook_call_number"),
  saleAmount: numeric("sale_amount", { precision: 10, scale: 2 }).notNull(),
  costAmount: numeric("cost_amount", { precision: 10, scale: 2 }),
  marginAmount: numeric("margin_amount", { precision: 10, scale: 2 }),
  paymentMethod: text("payment_method"),
  motorClub: text("motor_club"),
  coreDepositCollected: numeric("core_deposit_collected", { precision: 10, scale: 2 }),
  soldAt: timestamp("sold_at").defaultNow().notNull(),
  syncedFromQuickbooksAt: timestamp("synced_from_quickbooks_at"),
  quickbooksInvoiceId: text("quickbooks_invoice_id"),
}, (t) => ({
  companyIdx: index("sales_company_idx").on(t.companyId),
  driverIdx: index("sales_driver_idx").on(t.driverId),
  soldAtIdx: index("sales_sold_at_idx").on(t.soldAt),
}));

export const coreReturns = pgTable("core_returns", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  saleId: text("sale_id").references(() => sales.id),
  batteryId: text("battery_id").references(() => batteries.id),
  companyId: text("company_id").notNull().references(() => companies.id),
  locationId: text("location_id").notNull().references(() => locations.id),
  depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }),
  refundAmount: numeric("refund_amount", { precision: 10, scale: 2 }),
  returnedAt: timestamp("returned_at"),
  refundedAt: timestamp("refunded_at"),
  status: text("status"),
  notes: text("notes"),
});

export const companiesRelations = relations(companies, ({ many }) => ({
  locations: many(locations),
  userCompanies: many(userCompanies),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  company: one(companies, { fields: [locations.companyId], references: [companies.id] }),
  batteries: many(batteries),
  trucks: many(trucks),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  homeLocation: one(locations, { fields: [users.homeLocationId], references: [locations.id] }),
  userCompanies: many(userCompanies),
  sales: many(sales),
}));

export const userCompaniesRelations = relations(userCompanies, ({ one }) => ({
  user: one(users, { fields: [userCompanies.userId], references: [users.id] }),
  company: one(companies, { fields: [userCompanies.companyId], references: [companies.id] }),
}));

export const batteriesRelations = relations(batteries, ({ one, many }) => ({
  type: one(batteryTypes, { fields: [batteries.batteryTypeId], references: [batteryTypes.id] }),
  company: one(companies, { fields: [batteries.companyId], references: [companies.id] }),
  location: one(locations, { fields: [batteries.locationId], references: [locations.id] }),
  currentTruck: one(trucks, { fields: [batteries.currentTruckId], references: [trucks.id] }),
  currentDriver: one(users, { fields: [batteries.currentDriverId], references: [users.id] }),
  movements: many(batteryMovements),
}));

export const salesRelations = relations(sales, ({ one }) => ({
  battery: one(batteries, { fields: [sales.batteryId], references: [batteries.id] }),
  driver: one(users, { fields: [sales.driverId], references: [users.id] }),
  company: one(companies, { fields: [sales.companyId], references: [companies.id] }),
  location: one(locations, { fields: [sales.locationId], references: [locations.id] }),
}));

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Location = typeof locations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Battery = typeof batteries.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type MbsInvoice = typeof mbsInvoices.$inferSelect;
'@
Set-Content -Path "lib\db\schema.ts" -Value $schema -NoNewline
Write-Host "[1/9] Created: lib\db\schema.ts" -ForegroundColor Green

# ============================================================
# FILE 2: lib/db/index.ts
# ============================================================
$dbIndex = @'
import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import * as schema from "./schema";

export const db = drizzle(sql, { schema });

export * from "./schema";
'@
Set-Content -Path "lib\db\index.ts" -Value $dbIndex -NoNewline
Write-Host "[2/9] Created: lib\db\index.ts" -ForegroundColor Green

# ============================================================
# FILE 3: lib/auth.ts
# ============================================================
$auth = @'
import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
  userCompanies,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "owner" | "manager" | "dispatcher" | "driver";
      companyIds: string[];
      activeCompanyId: string | null;
      homeLocationId: string | null;
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],
  session: {
    strategy: "database",
  },
  callbacks: {
    async session({ session, user }) {
      const userRecord = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      });

      const companies = await db
        .select({ companyId: userCompanies.companyId })
        .from(userCompanies)
        .where(eq(userCompanies.userId, user.id));

      session.user.id = user.id;
      session.user.role = userRecord?.role ?? "driver";
      session.user.companyIds = companies.map((c) => c.companyId);
      session.user.homeLocationId = userRecord?.homeLocationId ?? null;
      session.user.activeCompanyId = companies[0]?.companyId ?? null;

      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
'@
Set-Content -Path "lib\auth.ts" -Value $auth -NoNewline
Write-Host "[3/9] Created: lib\auth.ts" -ForegroundColor Green

# ============================================================
# FILE 4: app/api/auth/[...nextauth]/route.ts
# ============================================================
$nextauthRoute = @'
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
'@
Set-Content -Path "app\api\auth\[...nextauth]\route.ts" -Value $nextauthRoute -NoNewline
Write-Host "[4/9] Created: app\api\auth\[...nextauth]\route.ts" -ForegroundColor Green

# ============================================================
# FILE 5: app/api/migrate/route.ts
# ============================================================
$migrateRoute = @'
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.MIGRATE_SECRET) {
    return NextResponse.json(
      { error: "Unauthorized. Add ?secret=YOUR_MIGRATE_SECRET to the URL." },
      { status: 401 }
    );
  }

  const results: string[] = [];

  try {
    await sql`DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('owner', 'manager', 'dispatcher', 'driver');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`;
    results.push("user_role enum");

    await sql`DO $$ BEGIN
      CREATE TYPE user_status AS ENUM ('active', 'inactive', 'terminated');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`;
    results.push("user_status enum");

    await sql`DO $$ BEGIN
      CREATE TYPE battery_status AS ENUM ('in_warehouse', 'on_truck', 'sold', 'returned_core', 'missing', 'damaged');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`;
    results.push("battery_status enum");

    await sql`DO $$ BEGIN
      CREATE TYPE truck_status AS ENUM ('active', 'in_maintenance', 'out_of_service');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`;
    results.push("truck_status enum");

    await sql`DO $$ BEGIN
      CREATE TYPE invoice_status AS ENUM ('pending_verification', 'verified', 'discrepancy', 'reconciled');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`;
    results.push("invoice_status enum");

    await sql`CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      legal_entity TEXT NOT NULL,
      quickbooks_realm_id TEXT,
      towbook_account_id TEXT,
      active BOOLEAN DEFAULT TRUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`;
    results.push("companies table");

    await sql`CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      active BOOLEAN DEFAULT TRUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      UNIQUE(company_id, slug)
    );`;
    results.push("locations table");

    await sql`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT NOT NULL UNIQUE,
      email_verified TIMESTAMP,
      image TEXT,
      role user_role DEFAULT 'driver' NOT NULL,
      status user_status DEFAULT 'active' NOT NULL,
      home_location_id TEXT REFERENCES locations(id),
      phone TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`;
    results.push("users table");

    await sql`CREATE TABLE IF NOT EXISTS user_companies (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, company_id)
    );`;
    results.push("user_companies table");

    await sql`CREATE TABLE IF NOT EXISTS accounts (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT,
      PRIMARY KEY (provider, provider_account_id)
    );`;
    results.push("accounts table");

    await sql`CREATE TABLE IF NOT EXISTS sessions (
      session_token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires TIMESTAMP NOT NULL
    );`;
    results.push("sessions table");

    await sql`CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL,
      expires TIMESTAMP NOT NULL,
      PRIMARY KEY (identifier, token)
    );`;
    results.push("verification_tokens table");

    await sql`CREATE TABLE IF NOT EXISTS battery_types (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      default_cost NUMERIC(10, 2),
      default_price NUMERIC(10, 2),
      par_level_min INTEGER DEFAULT 10,
      par_level_max INTEGER DEFAULT 50
    );`;
    results.push("battery_types table");

    await sql`CREATE TABLE IF NOT EXISTS trucks (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      location_id TEXT NOT NULL REFERENCES locations(id),
      fleet_number TEXT NOT NULL,
      make TEXT,
      model TEXT,
      year INTEGER,
      license TEXT,
      status truck_status DEFAULT 'active' NOT NULL,
      assigned_driver_id TEXT REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`;
    results.push("trucks table");

    await sql`CREATE TABLE IF NOT EXISTS batteries (
      id TEXT PRIMARY KEY,
      barcode TEXT NOT NULL UNIQUE,
      serial_number TEXT,
      battery_type_id TEXT NOT NULL REFERENCES battery_types(id),
      company_id TEXT NOT NULL REFERENCES companies(id),
      location_id TEXT NOT NULL REFERENCES locations(id),
      current_truck_id TEXT REFERENCES trucks(id),
      current_driver_id TEXT REFERENCES users(id),
      status battery_status DEFAULT 'in_warehouse' NOT NULL,
      cost NUMERIC(10, 2),
      mbs_invoice_id TEXT,
      received_at TIMESTAMP,
      sold_at TIMESTAMP,
      sold_by_id TEXT REFERENCES users(id),
      sold_on_call_number TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`;
    results.push("batteries table");

    await sql`CREATE INDEX IF NOT EXISTS battery_company_idx ON batteries(company_id);`;
    await sql`CREATE INDEX IF NOT EXISTS battery_location_idx ON batteries(location_id);`;
    await sql`CREATE INDEX IF NOT EXISTS battery_status_idx ON batteries(status);`;
    results.push("battery indexes");

    await sql`CREATE TABLE IF NOT EXISTS battery_movements (
      id TEXT PRIMARY KEY,
      battery_id TEXT NOT NULL REFERENCES batteries(id) ON DELETE CASCADE,
      from_status battery_status,
      to_status battery_status NOT NULL,
      from_location_id TEXT REFERENCES locations(id),
      to_location_id TEXT REFERENCES locations(id),
      from_driver_id TEXT REFERENCES users(id),
      to_driver_id TEXT REFERENCES users(id),
      occurred_at TIMESTAMP DEFAULT NOW() NOT NULL,
      recorded_by_id TEXT REFERENCES users(id),
      notes TEXT
    );`;
    results.push("battery_movements table");

    await sql`CREATE TABLE IF NOT EXISTS mbs_invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      company_id TEXT NOT NULL REFERENCES companies(id),
      location_id TEXT NOT NULL REFERENCES locations(id),
      invoice_date TIMESTAMP NOT NULL,
      due_date TIMESTAMP,
      total_amount NUMERIC(10, 2) NOT NULL,
      battery_count INTEGER NOT NULL,
      status invoice_status DEFAULT 'pending_verification' NOT NULL,
      raw_text TEXT,
      file_url TEXT,
      uploaded_by_id TEXT REFERENCES users(id),
      uploaded_at TIMESTAMP DEFAULT NOW() NOT NULL,
      verified_at TIMESTAMP,
      verified_by_id TEXT REFERENCES users(id)
    );`;
    results.push("mbs_invoices table");

    await sql`CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      location_id TEXT NOT NULL REFERENCES locations(id),
      battery_id TEXT NOT NULL REFERENCES batteries(id),
      driver_id TEXT NOT NULL REFERENCES users(id),
      customer_name TEXT,
      customer_phone TEXT,
      towbook_call_number TEXT,
      sale_amount NUMERIC(10, 2) NOT NULL,
      cost_amount NUMERIC(10, 2),
      margin_amount NUMERIC(10, 2),
      payment_method TEXT,
      motor_club TEXT,
      core_deposit_collected NUMERIC(10, 2),
      sold_at TIMESTAMP DEFAULT NOW() NOT NULL,
      synced_from_quickbooks_at TIMESTAMP,
      quickbooks_invoice_id TEXT
    );`;
    results.push("sales table");

    await sql`CREATE INDEX IF NOT EXISTS sales_company_idx ON sales(company_id);`;
    await sql`CREATE INDEX IF NOT EXISTS sales_driver_idx ON sales(driver_id);`;
    await sql`CREATE INDEX IF NOT EXISTS sales_sold_at_idx ON sales(sold_at);`;
    results.push("sales indexes");

    await sql`CREATE TABLE IF NOT EXISTS core_returns (
      id TEXT PRIMARY KEY,
      sale_id TEXT REFERENCES sales(id),
      battery_id TEXT REFERENCES batteries(id),
      company_id TEXT NOT NULL REFERENCES companies(id),
      location_id TEXT NOT NULL REFERENCES locations(id),
      deposit_amount NUMERIC(10, 2),
      refund_amount NUMERIC(10, 2),
      returned_at TIMESTAMP,
      refunded_at TIMESTAMP,
      status TEXT,
      notes TEXT
    );`;
    results.push("core_returns table");

    return NextResponse.json({
      success: true,
      message: "Migration complete! All tables created.",
      results,
      nextStep: "Visit /api/seed?secret=YOUR_MIGRATE_SECRET to populate companies and locations.",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        results,
      },
      { status: 500 }
    );
  }
}
'@
Set-Content -Path "app\api\migrate\route.ts" -Value $migrateRoute -NoNewline
Write-Host "[5/9] Created: app\api\migrate\route.ts" -ForegroundColor Green

# ============================================================
# FILE 6: app/api/seed/route.ts
# ============================================================
$seedRoute = @'
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.MIGRATE_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const results: string[] = [];

  try {
    const abqId = crypto.randomUUID();
    const phxId = crypto.randomUUID();
    const tucsonId = crypto.randomUUID();

    await sql`INSERT INTO companies (id, slug, name, legal_entity)
      VALUES (${abqId}, 'abq', 'Duggers ABQ', 'Duggers ABQ')
      ON CONFLICT (slug) DO NOTHING;`;
    results.push("Duggers ABQ");

    await sql`INSERT INTO companies (id, slug, name, legal_entity)
      VALUES (${phxId}, 'phx', 'Duggers PHX / ERS', 'Emergency Road Service')
      ON CONFLICT (slug) DO NOTHING;`;
    results.push("Duggers PHX / ERS");

    await sql`INSERT INTO companies (id, slug, name, legal_entity)
      VALUES (${tucsonId}, 'tucson', 'Express Roadside Tucson', 'Express Roadside Corporation')
      ON CONFLICT (slug) DO NOTHING;`;
    results.push("Express Roadside Tucson");

    const { rows: companies } = await sql`SELECT id, slug FROM companies;`;
    const abq = companies.find(c => c.slug === "abq")!.id;
    const phx = companies.find(c => c.slug === "phx")!.id;
    const tucson = companies.find(c => c.slug === "tucson")!.id;

    await sql`INSERT INTO locations (id, company_id, slug, name, city, state)
      VALUES (${crypto.randomUUID()}, ${abq}, 'abq-main', 'ABQ Main', 'Albuquerque', 'NM')
      ON CONFLICT (company_id, slug) DO NOTHING;`;
    results.push("ABQ Main");

    await sql`INSERT INTO locations (id, company_id, slug, name, city, state)
      VALUES (${crypto.randomUUID()}, ${phx}, 'camelback', 'Camelback', 'Phoenix', 'AZ')
      ON CONFLICT (company_id, slug) DO NOTHING;`;
    results.push("Camelback");

    await sql`INSERT INTO locations (id, company_id, slug, name, city, state)
      VALUES (${crypto.randomUUID()}, ${phx}, 'elwood', 'Elwood', 'Phoenix', 'AZ')
      ON CONFLICT (company_id, slug) DO NOTHING;`;
    results.push("Elwood");

    await sql`INSERT INTO locations (id, company_id, slug, name, city, state)
      VALUES (${crypto.randomUUID()}, ${tucson}, 'tucson-main', 'Tucson Main', 'Tucson', 'AZ')
      ON CONFLICT (company_id, slug) DO NOTHING;`;
    results.push("Tucson Main");

    const types: Array<[string, string, string, string, number, number]> = [
      ["Alpha", "Standard flooded lead-acid", "85.00", "159.00", 20, 50],
      ["Bravo", "Mid-range maintenance-free", "105.00", "189.00", 40, 100],
      ["Charlie", "High-performance starting battery", "135.00", "229.00", 30, 60],
      ["AMG", "Absorbent Glass Mat - premium", "175.00", "289.00", 15, 30],
    ];

    for (const [code, desc, cost, price, parMin, parMax] of types) {
      await sql`INSERT INTO battery_types
        (id, code, name, description, default_cost, default_price, par_level_min, par_level_max)
        VALUES (${crypto.randomUUID()}, ${code}, ${code}, ${desc},
                ${cost}, ${price}, ${parMin}, ${parMax})
        ON CONFLICT (code) DO NOTHING;`;
    }
    results.push("Battery types: Alpha, Bravo, Charlie, AGM");

    return NextResponse.json({
      success: true,
      message: "Seed complete!",
      results,
      nextStep: "Visit /login to sign in with GitHub, then visit /api/make-owner?secret=YOUR_MIGRATE_SECRET&email=YOUR_GITHUB_EMAIL",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error", results },
      { status: 500 }
    );
  }
}
'@
Set-Content -Path "app\api\seed\route.ts" -Value $seedRoute -NoNewline
Write-Host "[6/9] Created: app\api\seed\route.ts" -ForegroundColor Green

# ============================================================
# FILE 7: app/api/make-owner/route.ts
# ============================================================
$makeOwnerRoute = @'
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const email = req.nextUrl.searchParams.get("email");

  if (secret !== process.env.MIGRATE_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!email) {
    return NextResponse.json(
      { error: "Missing &email=YOUR_GITHUB_EMAIL in URL." },
      { status: 400 }
    );
  }

  try {
    const { rows: users } = await sql`SELECT id, email FROM users WHERE email = ${email};`;

    if (users.length === 0) {
      const { rows: allUsers } = await sql`SELECT email FROM users;`;
      return NextResponse.json(
        {
          error: `No user with email "${email}".`,
          hint: "Sign in via GitHub first at /login, then re-run this URL.",
          usersInDatabase: allUsers.map(u => u.email),
        },
        { status: 404 }
      );
    }

    const userId = users[0].id;

    await sql`UPDATE users SET role = 'owner' WHERE id = ${userId};`;

    const { rows: companies } = await sql`SELECT id, name FROM companies;`;
    const linkedCompanies: string[] = [];

    for (const company of companies) {
      await sql`INSERT INTO user_companies (user_id, company_id)
        VALUES (${userId}, ${company.id})
        ON CONFLICT DO NOTHING;`;
      linkedCompanies.push(company.name);
    }

    return NextResponse.json({
      success: true,
      message: `${email} is now the owner across all companies.`,
      role: "owner",
      linkedCompanies,
      nextStep: "Sign out and sign back in at /login to refresh your session.",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
'@
Set-Content -Path "app\api\make-owner\route.ts" -Value $makeOwnerRoute -NoNewline
Write-Host "[7/9] Created: app\api\make-owner\route.ts" -ForegroundColor Green

# ============================================================
# FILE 8: middleware.ts
# ============================================================
$middleware = @'
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/login", "/api/auth", "/api/migrate", "/api/seed", "/api/make-owner"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_ROUTES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$).*)"],
};
'@
Set-Content -Path "middleware.ts" -Value $middleware -NoNewline
Write-Host "[8/9] Created: middleware.ts" -ForegroundColor Green

# ============================================================
# FILE 9: drizzle.config.ts
# ============================================================
$drizzleConfig = @'
import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
'@
Set-Content -Path "drizzle.config.ts" -Value $drizzleConfig -NoNewline
Write-Host "[9/9] Created: drizzle.config.ts" -ForegroundColor Green

Write-Host ""
Write-Host "============================" -ForegroundColor Cyan
Write-Host "All 9 files created!" -ForegroundColor Green
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Verify in VS Code that all 9 files exist" -ForegroundColor White
Write-Host "  2. Reply 'Phase C done' to continue to Phase D (Vercel setup)" -ForegroundColor White
Write-Host ""
