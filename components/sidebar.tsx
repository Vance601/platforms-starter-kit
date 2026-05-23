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
  RotateCcw,
  PackageCheck,
  PackagePlus,
  DollarSign,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function Sidebar({ className }: React.HTMLAttributes<HTMLDivElement>) {
  const pathname = usePathname()

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

            {/* Assign tabs first */}
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

            {/* View tabs after */}
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

            {/* Other tabs */}
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
            <Button
              variant={pathname.startsWith("/core-returns") ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link href="/core-returns">
                <RotateCcw className="mr-2 h-4 w-4" />
                Core Returns
              </Link>
            </Button>
            <Button
              variant={pathname.startsWith("/core-returns/reconciliation") ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link href="/core-returns/reconciliation">
                <DollarSign className="mr-2 h-4 w-4" />
                Reconciliation
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
          <Button variant={pathname === "/reconcile" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
            <Link href="/reconcile">
              <Battery className="mr-2 h-4 w-4" />
              Battery Audit
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
        </div>
      </div>
    </div>
  )
}

export default Sidebar
