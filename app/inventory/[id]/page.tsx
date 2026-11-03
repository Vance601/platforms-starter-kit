import { redirect } from "next/navigation"

// This route used to render a hardcoded placeholder battery (v0 mock data).
// Nothing links here; send stray visits to the real list.
export default function Page() {
  redirect("/inventory")
}
