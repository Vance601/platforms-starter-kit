import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
    // STEP 1 — Clear the test trucks (#128/129/130)
    const { rowCount: cleared } = await sql`DELETE FROM trucks;`;
    results.push(`Cleared existing trucks: ${cleared}`);

    // STEP 2 — Add VIN / year-model columns (idempotent)
    await sql`ALTER TABLE trucks ADD COLUMN IF NOT EXISTS vin TEXT;`;
    await sql`ALTER TABLE trucks ADD COLUMN IF NOT EXISTS vin_last5 TEXT;`;
    await sql`ALTER TABLE trucks ADD COLUMN IF NOT EXISTS year_model TEXT;`;
    results.push("Added vin, vin_last5, year_model columns");

    // STEP 3 — Look up company IDs by slug
    const { rows: companies } = await sql`SELECT id, slug FROM companies;`;
    const phx = companies.find((c) => c.slug === "phx")?.id;
    const tucson = companies.find((c) => c.slug === "tucson")?.id;

    if (!phx || !tucson) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing company. phx=${phx ?? "NOT FOUND"}, tucson=${
            tucson ?? "NOT FOUND"
          }`,
          completedSteps: results,
        },
        { status: 404 }
      );
    }
    results.push("Found company IDs for phx and tucson");

    // STEP 4 — Seed trucks
    // [truck_number, company_id, year_model, vin, vin_last5]
    const trucks: [string, string, string, string | null, string | null][] = [
      ["124", phx, "2022 Chevy Colorado", "1GCHSBEAXN1326951", "26951"],
      ["125", phx, "2022 Chevy Colorado", "1GCHSBEN7N1214307", "14307"],
      ["126", phx, "2023 Ford Maverick", "3FTTW8E96PRA87849", "87849"],
      ["127", phx, "2023 Ford Maverick", "3FTTW8E96PRA89410", "89410"],
      ["128", phx, "2023 Ford Maverick", "3FTTW8E91PRA93140", "93140"],
      ["129", phx, "2023 Ford Maverick", "3FTTW8E92PRA89842", "89842"],
      ["130", phx, "2023 Ford Maverick", "1FTTW8E31PRA88452", "88452"],
      ["131", phx, "2024 Ford Maverick", null, null],
      ["132", phx, "2024 Ford Maverick", null, null],
      ["133", phx, "2024 Ford Maverick", null, null],
      ["134", phx, "2024 Ford Maverick", null, null],
      ["135", phx, "2024 Ford Maverick", null, null],
      ["81", tucson, "2021 Kia Rio", "3KPA24AD6ME422861", "22861"],
      ["86", tucson, "2011 Kia Sedona", "KNDMG4C72B6385011", "85011"],
    ];

    for (const [num, companyId, yearModel, vin, last5] of trucks) {
      await sql`
        INSERT INTO trucks (truck_number, company_id, capacity, active, year_model, vin, vin_last5)
        VALUES (${num}, ${companyId}, 20, TRUE, ${yearModel}, ${vin}, ${last5});
      `;
    }
    results.push(`Seeded ${trucks.length} trucks (12 PHX + 2 Tucson)`);

    // STEP 5 — Verification snapshot
    const { rows: snapshot } = await sql`
      SELECT trucks.truck_number, companies.slug AS company, trucks.year_model, trucks.vin_last5
      FROM trucks
      JOIN companies ON companies.id = trucks.company_id
      ORDER BY companies.slug, trucks.truck_number;
    `;
    results.push(
      `Trucks now in DB: ${snapshot
        .map((t) => `#${t.truck_number}(${t.company}/${t.vin_last5 ?? "no-vin"})`)
        .join(", ")}`
    );

    const { rows: total } = await sql`SELECT COUNT(*)::int AS count FROM trucks;`;
    results.push(`Total trucks: ${total[0].count}`);

    return NextResponse.json({ success: true, results });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        completedSteps: results,
      },
      { status: 500 }
    );
  }
}
