import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Customer-facing driver entry point: /d/<company>
//
// e.g. https://www.battery-city.com/d/phx
//
// This is the URL a customer's drivers bookmark or put on their home screen.
// It hands the company slug to the login page, which scopes the name picker to
// that customer and shows their name at the top. The slug is validated by the
// list API - an unknown slug returns no drivers rather than an error page, so
// nobody can probe which customers exist.
export default async function DriverEntryPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { company } = await params;
  const slug = (company || "").trim().toLowerCase();
  redirect(`/driver/login?c=${encodeURIComponent(slug)}`);
}
