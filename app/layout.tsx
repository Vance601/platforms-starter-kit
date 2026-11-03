import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import AppShell from "@/components/app-shell"

const inter = Inter({ subsets: ["latin"] })

const SITE_URL = "https://www.battery-city.com"
const TITLE = "Battery City | Battery inventory tracking, warranties & sales reports"
const DESCRIPTION = "Battery City tracks battery inventory across warehouses and trucks, manages warranties and core returns, and turns roadside sales into clear reports."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Battery City",
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Battery City",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppShell>{children}</AppShell>
            
            
        
        </ThemeProvider>
      </body>
    </html>
  )
}
