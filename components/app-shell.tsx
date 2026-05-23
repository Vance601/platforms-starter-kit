"use client"

import { usePathname } from "next/navigation"
import Sidebar from "@/components/sidebar"

export default function AppShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isDriver = pathname?.startsWith("/driver")

  if (isDriver) {
    // Standalone mobile shell for driver-facing pages — no owner sidebar, no left margin
    return (
      <div className="min-h-screen mx-auto w-full max-w-md px-4 py-4">
        {children}
      </div>
    )
  }

  // Owner shell — sidebar + offset main, exactly as before
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-4 overflow-auto">{children}</main>
    </div>
  )
}
