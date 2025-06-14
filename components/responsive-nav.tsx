"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Battery, Truck, AlertTriangle, ClipboardList, Menu, Home, X } from "lucide-react"

interface ResponsiveNavProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export function ResponsiveNav({ activeTab, setActiveTab }: ResponsiveNavProps) {
  const [open, setOpen] = useState(false)

  const tabs = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "inventory", label: "Inventory", icon: Battery },
    { id: "drivers", label: "Drivers", icon: Truck },
    { id: "alerts", label: "Alerts", icon: AlertTriangle },
    { id: "details", label: "Details", icon: ClipboardList },
  ]

  // Mobile bottom navigation - shows only icons
  const MobileBottomNav = () => (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden">
      <div className="flex justify-around items-center h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <Button
              key={tab.id}
              variant="ghost"
              size="icon"
              className={`h-12 w-12 rounded-full ${activeTab === tab.id ? "bg-primary/10 text-primary" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="h-5 w-5" />
              <span className="sr-only">{tab.label}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )

  // Tablet sidebar navigation
  const TabletSidebar = () => (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[240px] sm:w-[300px] p-0">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">Dugger's Battery</h2>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-auto py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <Button
                  key={tab.id}
                  variant="ghost"
                  className={`w-full justify-start px-4 py-6 mb-1 ${
                    activeTab === tab.id ? "bg-primary/10 text-primary" : ""
                  }`}
                  onClick={() => {
                    setActiveTab(tab.id)
                    setOpen(false)
                  }}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {tab.label}
                </Button>
              )
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )

  // Desktop/iPad landscape horizontal tabs
  const DesktopTabs = () => (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="hidden md:block">
      <TabsList className="h-12 w-full justify-start">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <TabsTrigger key={tab.id} value={tab.id} className="text-base h-full px-4 flex items-center">
              <Icon className="mr-2 h-5 w-5" />
              {tab.label}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <TabletSidebar />
        <DesktopTabs />
      </div>
      <MobileBottomNav />
    </>
  )
}
