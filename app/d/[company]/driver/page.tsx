import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Customer driver entry point: /d/<org>/driver
//
// e.g. https://www.battery-city.com/d/duggers/driver
//
// The folder is named [company] because Next.js requires one dynamic segment
// name per level and that folder already existed - but the value it carries is
// the ORGANIZATION slug. All of a customer's locations share one driver login,
// so Phoenix, Albuquerque and Tucson drivers all use this same link.
//
// The slug is validated by the list API: an unknown org returns an empty picker
// rather than an error, so nobody can probe which customers exist.
export default async function OrgDriverEntryPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { company } = await params;
  const slug = (company || "").trim().toLowerCase();
  redirect(`/driver/login?o=${encodeURIComponent(slug)}`);
}
