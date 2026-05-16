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