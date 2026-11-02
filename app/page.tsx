// "/" router: signed-in users without an organization go to /onboarding;
// everyone else with an org sees the dashboard exactly as before.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import Dashboard from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.orgId) redirect("/onboarding");
  return <Dashboard />;
}
