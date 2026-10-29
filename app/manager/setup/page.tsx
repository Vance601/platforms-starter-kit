import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Retired: this page set passwords behind a shared secret and silently
// promoted users to manager. Password resets now live at /admin/users,
// which requires a real owner/manager session and never changes roles.
export default function ManagerSetupRetired() {
  redirect("/admin/users");
}
