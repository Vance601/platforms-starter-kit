"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Boxes,
  Home,
  Package,
  Settings,
  Truck,
  Users,
  Battery,
  PackageCheck,
  PackagePlus,
  FileText,
  MapPin,
  ClipboardCheck,
  QrCode,
  Scale,
  ClipboardList,
  LogOut,
} from "lucide-react"

import { signOut } from "next-auth/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function Sidebar({ className }: React.HTMLAttributes<HTMLDivElement>) {
  const pathname = usePathname()

  // End the session on a shared terminal. Clears the manager cookie first,
  // then hands off to NextAuth which clears any GitHub session and redirects.
  // Works for either login type -- whichever is not present is a no-op.
  async function handleSignOut() {
    try {
      await fetch("/api/auth-manager", { method: "DELETE" })
    } catch {
      // Cookie clearing is best-effort; still sign out of NextAuth below.
    }
    await signOut({ callbackUrl: "/login" })
  }

  return (
    <div
      className={cn("h-screen w-64 flex-shrink-0 border-r bg-background fixed left-0 top-0 overflow-y-auto", className)}
    >
      <div className="space-y-2 py-2">
        <div className="px-3 py-1">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">Duggers Tracker</h2>
          <div className="space-y-0.5">
            <Button variant={pathname === "/" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>

            <Button
              variant={pathname === "/receive-order" ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link href="/receive-order">
                <PackageCheck className="mr-2 h-4 w-4" />
                Receive Order
              </Link>
            </Button>
            <Button
              variant={pathname === "/auto-reorders" ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link href="/auto-reorders">
                <PackagePlus className="mr-2 h-4 w-4" />
                Auto Reorders
              </Link>
            </Button>

            <Button
              variant={pathname === "/inventory" ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link href="/inventory">
                <Boxes className="mr-2 h-4 w-4" />
                Inventory
              </Link>
            </Button>
            <Button
              variant={pathname === "/batteries" ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link href="/batteries">
                <Battery className="mr-2 h-4 w-4" />
                Batteries
              </Link>
            </Button>

            <Button variant={pathname === "/fleet" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
              <Link href="/fleet">
                <Truck className="mr-2 h-4 w-4" />
                Fleet
              </Link>
            </Button>
            <Button variant={pathname === "/team" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
              <Link href="/team">
                <Users className="mr-2 h-4 w-4" />
                Team
              </Link>
            </Button>
          </div>
        </div>
        <div className="px-3 py-1">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">Reports</h2>
          <div className="space-y-0.5">
            <Button variant={pathname === "/reports" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
              <Link href="/reports">
                <BarChart3 className="mr-2 h-4 w-4" />
                Analytics
              </Link>
            </Button>
            <Button variant={pathname === "/alerts" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
              <Link href="/alerts">
                <Package className="mr-2 h-4 w-4" />
                Alerts
              </Link>
            </Button>
          </div>
        </div>
        <div className="px-3 py-1">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">Admin</h2>
          <Button variant={pathname === "/admin/drivers" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
            <Link href="/admin/drivers">
              <Users className="mr-2 h-4 w-4" />
              Drivers
            </Link>
          </Button>
          <Button variant={pathname === "/locations" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
            <Link href="/locations">
              <MapPin className="mr-2 h-4 w-4" />
              Locations
            </Link>
          </Button>
          <Button variant={pathname === "/reconcile" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
            <Link href="/reconcile">
              <Battery className="mr-2 h-4 w-4" />
              Battery Audit
            </Link>
          </Button>
          <Button variant={pathname === "/warranty-report" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
            <Link href="/warranty-report">
              <FileText className="mr-2 h-4 w-4" />
              Warranty Report
            </Link>
          </Button>
          <Button variant={pathname === "/warranty" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
            <Link href="/warranty">
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Warranty Reconcile
            </Link>
          </Button>
          <Button variant={pathname === "/core-accountability" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
            <Link href="/core-accountability">
              <Scale className="mr-2 h-4 w-4" />
              Core Accountability
            </Link>
          </Button>
          <Button variant={pathname === "/core-reconcile" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
            <Link href="/core-reconcile">
              <ClipboardList className="mr-2 h-4 w-4" />
              Driver Reconcile
            </Link>
          </Button>
          <Button variant={pathname === "/driver-sales" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
            <Link href="/driver-sales">
              <BarChart3 className="mr-2 h-4 w-4" />
              Driver Sales
            </Link>
          </Button>
          <Button variant={pathname === "/admin/load-approvals" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
            <Link href="/admin/load-approvals">
              <PackageCheck className="mr-2 h-4 w-4" />
              Load Approvals
            </Link>
          </Button>
          <Button variant={pathname === "/admin/assign-trucks" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
            <Link href="/admin/assign-trucks">
              <Truck className="mr-2 h-4 w-4" />
              Assign to Trucks
            </Link>
          </Button>
          <Button variant={pathname === "/print-labels" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
            <Link href="/print-labels">
              <QrCode className="mr-2 h-4 w-4" />
              Print Labels
            </Link>
          </Button>
          <Button variant={pathname === "/truck-labels" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
            <Link href="/truck-labels">
              <Truck className="mr-2 h-4 w-4" />
              Truck QR Codes
            </Link>
          </Button>
        </div>
        <div className="px-3 py-1">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">Settings</h2>
          <Button variant={pathname === "/settings" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
            <Link href="/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Sidebar
