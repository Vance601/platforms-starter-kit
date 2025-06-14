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
import { BarChart, Bell, LayoutDashboard, ListChecks, ShoppingCart, User } from "lucide-react"

import { Icons } from "@/components/icons"

export interface NavItem {
  title: string
  href: string
  icon?: React.ReactNode
  disabled?: boolean
  external?: boolean
  variant?: "default" | "ghost"
}

export interface NavItemWithChildren extends NavItem {
  items: NavItem[]
}

export type MainNavItem = NavItem

export type SidebarNavItem = NavItemWithChildren

interface DocsConfig {
  mainNav: MainNavItem[]
  sidebarNav: SidebarNavItem[]
}

export const docsConfig: DocsConfig = {
  mainNav: [
    {
      title: "Documentation",
      href: "/docs",
    },
    {
      title: "Components",
      href: "/components",
    },
    {
      title: "Examples",
      href: "/examples",
    },
    {
      title: "GitHub",
      href: "https://github.com/shadcn/ui",
      external: true,
    },
  ],
  sidebarNav: [
    {
      title: "Getting Started",
      items: [
        {
          title: "Introduction",
          href: "/docs",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Installation",
          href: "/docs/installation",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Typography",
          href: "/docs/typography",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Dark mode",
          href: "/docs/dark-mode",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "shadcn/ui",
          href: "/docs/shadcn-ui",
          icon: Icons.chevronRight,
          variant: "default",
          disabled: true,
        },
        {
          title: "Controlling animations",
          href: "/docs/animations",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Releases",
          href: "/docs/releases",
          icon: Icons.chevronRight,
          variant: "default",
        },
      ],
    },
    {
      title: "Components",
      items: [
        {
          title: "Alert",
          href: "/docs/components/alert",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Accordion",
          href: "/docs/components/accordion",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Aspect Ratio",
          href: "/docs/components/aspect-ratio",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Alert Dialog",
          href: "/docs/components/alert-dialog",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Avatar",
          href: "/docs/components/avatar",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Badge",
          href: "/docs/components/badge",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Button",
          href: "/docs/components/button",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Card",
          href: "/docs/components/card",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Checkbox",
          href: "/docs/components/checkbox",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Collapsible",
          href: "/docs/components/collapsible",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Combobox",
          href: "/docs/components/combobox",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Command",
          href: "/docs/components/command",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Dialog",
          href: "/docs/components/dialog",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Dropdown Menu",
          href: "/docs/components/dropdown-menu",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Form",
          href: "/docs/components/form",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Input",
          href: "/docs/components/input",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Label",
          href: "/docs/components/label",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Menubar",
          href: "/docs/components/menubar",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Navigation Menu",
          href: "/docs/components/navigation-menu",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Popover",
          href: "/docs/components/popover",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Progress",
          href: "/docs/components/progress",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Radio Group",
          href: "/docs/components/radio-group",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Scroll Area",
          href: "/docs/components/scroll-area",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Select",
          href: "/docs/components/select",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Separator",
          href: "/docs/components/separator",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Sheet",
          href: "/docs/components/sheet",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Skeleton",
          href: "/docs/components/skeleton",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Slider",
          href: "/docs/components/slider",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Switch",
          href: "/docs/components/switch",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Table",
          href: "/docs/components/table",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Tabs",
          href: "/docs/components/tabs",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Textarea",
          href: "/docs/components/textarea",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Toast",
          href: "/docs/components/toast",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Toggle",
          href: "/docs/components/toggle",
          icon: Icons.chevronRight,
          variant: "default",
        },
        {
          title: "Tooltip",
          href: "/docs/components/tooltip",
          icon: Icons.chevronRight,
          variant: "default",
        },
      ],
    },
    {
      title: "Dashboard",
      items: [
        {
          title: "Overview",
          href: "/dashboard",
          icon: LayoutDashboard,
          variant: "default",
        },
        {
          title: "Analytics",
          href: "/dashboard/analytics",
          icon: BarChart,
          variant: "default",
        },
        {
          title: "Sales",
          href: "/dashboard/sales",
          icon: ShoppingCart,
          variant: "default",
        },
        {
          title: "Alerts",
          href: "/dashboard/alerts",
          icon: Bell,
          variant: "default",
        },
        {
          title: "Auto Reorders",
          href: "/auto-reorders",
          icon: <PackagePlus className="h-4 w-4" />,
          variant: "default",
        },
        {
          title: "Reports",
          href: "/dashboard/reports",
          icon: BarChart,
          variant: "default",
        },
        {
          title: "Integrations",
          href: "/dashboard/integrations",
          icon: Settings,
          variant: "default",
        },
      ],
    },
    {
      title: "Account",
      items: [
        {
          title: "Profile",
          href: "/account",
          icon: User,
          variant: "default",
        },
        {
          title: "Settings",
          href: "/account/settings",
          icon: Settings,
          variant: "default",
        },
        {
          title: "Billing",
          href: "/account/billing",
          icon: ShoppingCart,
          variant: "default",
        },
        {
          title: "Feedback",
          href: "/account/feedback",
          icon: ListChecks,
          variant: "default",
        },
      ],
    },
    {
      title: "Examples",
      items: [
        {
          title: "Tasks",
          href: "/examples/tasks",
          icon: ListChecks,
          variant: "default",
        },
        {
          title: "Kanban",
          href: "/examples/kanban",
          icon: LayoutDashboard,
          variant: "default",
        },
        {
          title: "File Manager",
          href: "/examples/file-manager",
          icon: LayoutDashboard,
          variant: "default",
        },
        {
          title: "Calendar",
          href: "/examples/calendar",
          icon: LayoutDashboard,
          variant: "default",
        },
        {
          title: "Chat",
          href: "/examples/chat",
          icon: LayoutDashboard,
          variant: "default",
        },
      ],
    },
  ],
}

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
