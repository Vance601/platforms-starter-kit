// Old mock page (fake data). Redirects to the real screen.
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/core-accountability");
}
