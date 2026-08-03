import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Bare /d/<org> -> /d/<org>/driver
//
// Keeps the shorter link working if anyone bookmarked it, and gives room for
// other per-customer entry points under /d/<org>/... later (manager, reports).
export default async function OrgEntryPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { company } = await params;
  const slug = (company || "").trim().toLowerCase();
  redirect(`/d/${encodeURIComponent(slug)}/driver`);
}
