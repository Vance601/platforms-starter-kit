"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Overview } from "@/components/overview"
import { BatteryStats } from "@/components/battery-stats"
import { Button } from "@/components/ui/button"
import {
  PlusCircle,
  AlertTriangle,
  Building2,
  BarChart3,
  Truck,
  Battery,
  ClipboardList,
  PackagePlus,
  Package,
  Warehouse,
} from "lucide-react"
import Link from "next/link"
import { AddInventoryModal } from "@/components/add-inventory-modal"
import { BatteryInventoryChart } from "@/components/battery-inventory-chart"
import { DriverPerformanceChart } from "@/components/driver-performance-chart"
import { useInventoryStore } from "@/lib/inventory-store"
import { useAutoReorderManager } from "@/components/auto-reorder-manager"

type Summary = {
  success: boolean
  total: number
  inWarehouse: number
  onTruck: number
  returnedCore: number
  byType: Record<string, number>
  byLocation: Record<string, number>
  byStatus: Record<string, number>
  typeLocation: Record<string, Record<string, number>>
}

export default function Dashboard() {
  const { inventory } = useInventoryStore()
  const autoReorderManager = useAutoReorderManager()

  const [summary, setSummary] = useState<Summary | null>(null)
  useEffect(() => {
    fetch("/api/inventory/summary", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.success) setSummary(j)
      })
      .catch(() => {})
  }, [])

  const totalBatteries = summary?.total ?? 0
  const inWarehouse = summary?.inWarehouse ?? 0
  const onTruck = summary?.onTruck ?? 0
  const byLocation = summary?.byLocation ?? {}
  const locationNames = Object.keys(byLocation).sort()

  const pendingReorders = autoReorderManager?.getPendingReorders ? autoReorderManager.getPendingReorders() : []

  const [alerts, setAlerts] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const savedAlerts = localStorage.getItem("criticalAlerts")
      if (savedAlerts) {
        try {
          return JSON.parse(savedAlerts)
        } catch (e) {
          console.error("Error parsing saved alerts:", e)
          return []
        }
      }
    }
    return []
  })

  const prevInventoryRef = useRef<any>(null)

  useEffect(() => {
    if (!Array.isArray(inventory)) {
      console.error("Inventory is not an array")
      return
    }
    if (prevInventoryRef.current === inventory) {
      return
    }
    prevInventoryRef.current = inventory

    try {
      const newAlerts = []
      const now = new Date()
      const timestamp = now.toLocaleString()

      inventory.forEach((item) => {
        if (!item || !item.locations) return

        const thresholds = {
          Alpha: { broadway: 10, camelback: 8 },
          Bravo: { broadway: 15, camelback: 12 },
          Charlie: { broadway: 8, camelback: 6 },
          AMG: { broadway: 5, camelback: 4 },
        }

        const typeThresholds = thresholds[item.type as keyof typeof thresholds] || { broadway: 10, camelback: 8 }

        if ((item.locations.broadway || 0) < typeThresholds.broadway) {
          newAlerts.push({
            id: `ALERT-${item.type}-broadway`,
            type: "Low Inventory",
            location: "Broadway",
            item: `${item.type} Batteries`,
            level: (item.locations.broadway || 0) < typeThresholds.broadway / 2 ? "Critical" : "Warning",
            threshold: typeThresholds.broadway,
            current: item.locations.broadway || 0,
            timestamp,
            status: "Active",
          })
        }

        if ((item.locations.camelback || 0) < typeThresholds.camelback) {
          newAlerts.push({
            id: `ALERT-${item.type}-camelback`,
            type: "Low Inventory",
            location: "Camelback",
            item: `${item.type} Batteries`,
            level: (item.locations.camelback || 0) < typeThresholds.camelback / 2 ? "Critical" : "Warning",
            threshold: typeThresholds.camelback,
            current: item.locations.camelback || 0,
            timestamp,
            status: "Active",
          })
        }
      })

      let existingAlerts: any[] = []
      if (typeof window !== "undefined") {
        const savedAlerts = localStorage.getItem("criticalAlerts")
        if (savedAlerts) {
          try {
            existingAlerts = JSON.parse(savedAlerts)
          } catch (e) {
            console.error("Error parsing saved alerts:", e)
          }
        }
      }

      const mergedAlerts = newAlerts.map((newAlert) => {
        const existingAlert = existingAlerts.find((a) => a.id === newAlert.id)
        if (existingAlert && existingAlert.status === "Resolved") {
          return existingAlert
        }
        return newAlert
      })

      if (typeof window !== "undefined") {
        localStorage.setItem("criticalAlerts", JSON.stringify(mergedAlerts))
      }

      setAlerts(mergedAlerts)
    } catch (error) {
      console.error("Error generating alerts:", error)
    }
  }, [inventory])

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<any>(null)

  const handleResolveClick = (alert: any) => {
    setSelectedAlert(alert)
    setModalOpen(true)
  }

  const handleResolveAlert = (alertId: string, quantity: number, notes: string, location: string) => {
    setAlerts((prevAlerts) => {
      if (!Array.isArray(prevAlerts)) {
        return []
      }
      const updatedAlerts = prevAlerts.map((alert) => {
        if (alert.id === alertId) {
          return {
            ...alert,
            status: "Resolved",
            current: alert.current + quantity,
            resolveNotes: notes,
            resolveTimestamp: new Date().toISOString(),
            resolveLocation: location,
          }
        }
        return alert
      })
      if (typeof window !== "undefined") {
        localStorage.setItem("criticalAlerts", JSON.stringify(updatedAlerts))
      }
      return updatedAlerts
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dugger's Battery Program</h1>
        <div className="flex items-center gap-2">
          {Array.isArray(pendingReorders) && pendingReorders.length > 0 && (
            <Link href="/auto-reorders">
              <Button variant="outline" className="text-base h-11">
                <PackagePlus className="mr-2 h-5 w-5" />
                Auto-Reorders ({pendingReorders.length})
              </Button>
            </Link>
          )}
          <Link href="/batteries/new">
            <Button className="text-base h-11">
              <PlusCircle className="mr-2 h-5 w-5" />
              Add Battery
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards — real data from /api/inventory/summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4">
            <CardTitle className="text-base font-medium">Total Batteries</CardTitle>
            <Package className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-3">
            <div className="text-2xl font-bold">{totalBatteries}</div>
            <p className="text-sm text-muted-foreground">
              {inWarehouse} in warehouse, {onTruck} on trucks
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4">
            <CardTitle className="text-base font-medium">Locations</CardTitle>
            <Building2 className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-3">
            {locationNames.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stock yet</p>
            ) : (
              <div className="space-y-1">
                {locationNames.map((loc) => (
                  <div key={loc} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{loc}</span>
                    <span className="font-semibold">{byLocation[loc]}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4">
            <CardTitle className="text-base font-medium">In Warehouse</CardTitle>
            <Warehouse className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-3">
            <div className="text-2xl font-bold">{inWarehouse}</div>
            <p className="text-sm text-muted-foreground">Available to assign or sell</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4">
            <CardTitle className="text-base font-medium">On Trucks</CardTitle>
            <Truck className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-3">
            <div className="text-2xl font-bold">{onTruck}</div>
            <p className="text-sm text-muted-foreground">Loaded on vehicles</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="py-2 px-4 flex items-center">
            <BarChart3 className="mr-2 h-5 w-5" />
            <div>
              <CardTitle className="text-xl">Battery Inventory Review</CardTitle>
              <CardDescription className="text-base">Battery inventory distribution across locations</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-2">
            <div className="h-[300px]">
              <Overview />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center py-2 px-4">
            <AlertTriangle className="mr-2 h-5 w-5" />
            <div>
              <CardTitle className="text-xl">Critical Alerts</CardTitle>
              <CardDescription className="text-base">Low battery inventory alerts</CardDescription>
            </div>
            <div className="ml-auto">
              <Link href="/alerts">
                <Button variant="outline" className="text-base h-10">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-2">
            <div className="space-y-3">
              {Array.isArray(pendingReorders) && pendingReorders.length > 0 && (
                <div className="flex items-start space-x-3 rounded-md border p-3 bg-amber-50/30">
                  <PackagePlus className="mt-0.5 h-5 w-5 text-amber-500" />
                  <div className="flex-1">
                    <p className="text-base font-medium leading-none">Automatic Reorders Pending</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {pendingReorders.length} reorders need to be processed
                    </p>
                  </div>
                  <Link href="/auto-reorders">
                    <Button variant="outline" className="h-10 text-base">
                      View Reorders
                    </Button>
                  </Link>
                </div>
              )}

              {Array.isArray(alerts) &&
                alerts
                  .filter((alert) => alert.level === "Critical" && alert.status === "Active")
                  .map((alert) => (
                    <div key={alert.id} className="flex items-start space-x-3 rounded-md border p-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
                      <div className="flex-1">
                        <p className="text-base font-medium leading-none">
                          Low {alert.item} at {alert.location} Location
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Current: {alert.current} (Threshold: {alert.threshold}) • {alert.timestamp}
                        </p>
                      </div>
                      <Button variant="outline" className="h-10 text-base" onClick={() => handleResolveClick(alert)}>
                        <PlusCircle className="mr-2 h-5 w-5" />
                        Add
                      </Button>
                    </div>
                  ))}

              {(!Array.isArray(alerts) ||
                alerts.filter((alert) => alert.level === "Critical" && alert.status === "Active").length === 0) &&
                (!Array.isArray(pendingReorders) || pendingReorders.length === 0) && (
                  <div className="text-center py-4 text-muted-foreground">No critical alerts at this time</div>
                )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Battery Inventory Section */}
      <Card className="shadow-sm">
        <CardHeader className="py-2 px-4 flex items-center">
          <Battery className="mr-2 h-5 w-5" />
          <div>
            <CardTitle className="text-xl">Battery Inventory</CardTitle>
            <CardDescription className="text-base">Current stock levels by battery type and location</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-2">
          <BatteryInventoryChart />
        </CardContent>
      </Card>

      {/* Driver Performance Section */}
      <Card className="shadow-sm">
        <CardHeader className="py-2 px-4 flex items-center">
          <Truck className="mr-2 h-5 w-5" />
          <div>
            <CardTitle className="text-xl">Driver Performance</CardTitle>
            <CardDescription className="text-base">Key performance indicators by driver</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-2">
          <DriverPerformanceChart />
        </CardContent>
      </Card>

      {/* Detailed Stats Section */}
      <Card className="shadow-sm">
        <CardHeader className="py-2 px-4 flex items-center">
          <ClipboardList className="mr-2 h-5 w-5" />
          <div>
            <CardTitle className="text-xl">Detailed Battery Statistics</CardTitle>
            <CardDescription className="text-base">Detailed view of battery inventory metrics</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-2">
          <BatteryStats />
        </CardContent>
      </Card>

      <AddInventoryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        alert={selectedAlert}
        onResolve={handleResolveAlert}
      />
    </div>
  )
}
