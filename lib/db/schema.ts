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