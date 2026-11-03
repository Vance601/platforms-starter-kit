import type { Metadata } from "next"

const URL = "https://www.battery-city.com/warranty-lookup"
const TITLE = "Battery warranty lookup | Battery City"
const DESCRIPTION = "Look up a battery's warranty status by serial number or receipt with Battery City."

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
