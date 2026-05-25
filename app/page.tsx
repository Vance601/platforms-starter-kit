"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlusCircle, Building2, Truck, Battery, Package, Warehouse, RotateCcw } from "lucide-react"
import Link from "next/link"

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

const TYPE_ACCENT: Record<string, string> = {
  Alpha: "border-l-blue-600 text-blue-600",
  Bravo: "border-l-green-600 text-green-600",
  AMG: "border-l-red-600 text-red-600",
  Tesla: "border-l-purple-600 text-purple-600",
  Prius: "border-l-amber-600 text-amber-600",
}

export default function Dashboard() {
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
  const returnedCore = summary?.returnedCore ?? 0
  const byLocation = summary?.byLocation ?? {}
  const byType = summary?.byType ?? {}
  const typeLocation = summary?.typeLocation ?? {}
  const locationNames = Object.keys(byLocation).sort()
  const typeNames = Object.keys(byType).sort()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dugger's Battery Program</h1>
        <div className="flex items-center gap-2">
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

      {/* By Battery Type */}
      <div>
        <h2 className="text-xl font-semibold mb-3 mt-2">By Battery Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {typeNames.length === 0 && (
            <p className="text-muted-foreground">No batteries in inventory.</p>
          )}
          {typeNames.map((type) => {
            const accent = TYPE_ACCENT[type] || "border-l-slate-500 text-slate-600"
            const [borderClass, textClass] = accent.split(" ")
            const locations = typeLocation[type] || {}
            return (
              <Card key={type} className={`shadow-sm border-l-4 ${borderClass}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <Battery className={`mr-2 h-5 w-5 ${textClass}`} />
                    {type}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{byType[type]}</div>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {Object.keys(locations).sort().map((loc) => (
                      <div key={loc} className="flex justify-between">
                        <span>{loc}</span>
                        <span className="font-medium text-foreground">{locations[loc]}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Returned cores note */}
      <Card className="shadow-sm border-l-4 border-l-purple-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4">
          <CardTitle className="text-base font-medium flex items-center">
            <RotateCcw className="mr-2 h-5 w-5 text-purple-500" />
            Returned Cores
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-3">
          <div className="text-2xl font-bold">{returnedCore}</div>
          <p className="text-sm text-muted-foreground">Awaiting core return</p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Live data from the battery database. Full list on the{" "}
        <Link href="/batteries" className="underline">Batteries</Link> page;
        detailed breakdown on{" "}
        <Link href="/inventory" className="underline">Inventory</Link>.
      </p>
    </div>
  )
}
