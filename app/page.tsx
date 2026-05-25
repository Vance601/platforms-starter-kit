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
                <PackagePlus className="mr-
