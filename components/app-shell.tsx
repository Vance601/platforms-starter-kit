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

  // Ends the driver's shift on a shared phone or tablet. Clears the
  // driver_session cookie and returns to the PIN screen.
  async function handleDriverSignOut() {
    try {
      await fetch("/api/auth-driver", { method: "DELETE" })
    } catch {
      // best effort
    }
    window.location.href = "/driver/login"
  }

  if (isDriver) {
    // Standalone mobile shell for driver-facing pages — no owner sidebar, no left margin
    const isDriverLogin = pathname?.startsWith("/driver/login")
    return (
      <div className="min-h-screen mx-auto w-full max-w-md px-4 py-4">
        {children}
        {!isDriverLogin ? (
          <div className="mt-8 border-t border-slate-700 pt-4 pb-8">
            <button
              onClick={handleDriverSignOut}
              className="w-full rounded-lg border border-slate-700 px-4 py-3 text-sm font-medium text-slate-400 hover:border-red-500 hover:text-red-400"
            >
              Sign out
            </button>
          </div>
        ) : null}
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
