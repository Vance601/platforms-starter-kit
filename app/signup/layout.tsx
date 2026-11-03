import type { Metadata } from "next"

const URL = "https://www.battery-city.com/signup"
const TITLE = "Sign up | Battery City"
const DESCRIPTION = "Create a Battery City account to track battery inventory, warranties and core returns, and get clear sales reports."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: { url: URL, title: TITLE, description: DESCRIPTION, siteName: "Battery City", type: "website" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
