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