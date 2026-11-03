import type { Metadata } from "next"

const URL = "https://www.battery-city.com/login"
const TITLE = "Log in | Battery City"
const DESCRIPTION = "Log in to Battery City to manage battery inventory, warranties, fleet trucks and sales reports."

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
