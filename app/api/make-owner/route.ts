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