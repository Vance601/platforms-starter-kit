"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Battery, Truck, AlertTriangle, Package, Warehouse, RotateCcw, RefreshCw } from "lucide-react"
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
  error?: string
}

// Color accent per battery type, falls back to slate for any new type.
const TYPE_ACCENT: Record<string, string> = {
  Alpha: "border-l-blue-600 text-blue-600",
  Bravo: "border-l-green-600 text-green-600",
  AMG: "border-l-red-600 text-red-600",
  Tesla: "border-l-purple-600 text-purple-600",
  Prius: "border-l-amber-600 text-amber-600",
}

const LOW_STOCK_THRESHOLD = 5

export default function InventoryPage() {
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/inventory/summary", { cache: "no-store" })
      const json: Summary = await res.json()
      if (!json.success) throw new Error(json.error || "Failed to load inventory")
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inventory")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const types = data ? Object.keys(data.byType).sort() : []
  const lowStockTypes = data ? types.filter((t) => (data.byType[t] || 0) < LOW_STOCK_THRESHOLD) : []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Inventory Control</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-5 w-5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/admin/assign-trucks">
            <Button className="text-base h-11">
              <Truck className="mr-2 h-5 w-5" />
              Assign to Trucks
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="py-4 text-red-600">{error}</CardContent>
        </Card>
      )}

      {loading && !data && (
        <div className="text-muted-foreground py-8 text-center">Loading live inventory…</div>
      )}

      {data && (
        <>
          {/* Top-line status cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <Package className="mr-2 h-5 w-5 text-blue-500" />
                  Total Batteries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.total}</div>
                <p className="text-sm text-muted-foreground">All types, all locations</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <Warehouse className="mr-2 h-5 w-5 text-green-500" />
                  In Warehouse
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.inWarehouse}</div>
                <p className="text-sm text-muted-foreground">Available to assign or sell</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-l-4 border-l-amber-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <Truck className="mr-2 h-5 w-5 text-amber-500" />
                  On Trucks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.onTruck}</div>
                <p className="text-sm text-muted-foreground">Loaded on vehicles</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <RotateCcw className="mr-2 h-5 w-5 text-purple-500" />
                  Returned Cores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.returnedCore}</div>
                <p className="text-sm text-muted-foreground">Awaiting core return</p>
              </CardContent>
            </Card>
          </div>

          {/* Per-type cards with location splits */}
          <div>
            <h2 className="text-xl font-semibold mb-3">By Battery Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {types.length === 0 && (
                <p className="text-muted-foreground">No batteries in inventory.</p>
              )}
              {types.map((type) => {
                const accent = TYPE_ACCENT[type] || "border-l-slate-500 text-slate-600"
                const [borderClass, textClass] = accent.split(" ")
                const locations = data.typeLocation[type] || {}
                return (
                  <Card key={type} className={`bg-white border-l-4 ${borderClass}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        <Battery className={`mr-2 h-5 w-5 ${textClass}`} />
                        {type}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{data.byType[type]}</div>
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

          {/* Per-location totals */}
          <div>
            <h2 className="text-xl font-semibold mb-3">By Location</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.keys(data.byLocation).sort().map((loc) => (
                <Card key={loc} className="bg-white border-l-4 border-l-slate-400">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{loc}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{data.byLocation[loc]}</div>
                    <p className="text-sm text-muted-foreground">Total batteries</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Low stock */}
          <Card className="bg-white border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5 text-amber-500" />
                Low Stock (under {LOW_STOCK_THRESHOLD})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{lowStockTypes.length}</div>
              {lowStockTypes.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {lowStockTypes.map((t) => `${t} (${data.byType[t]})`).join(", ")}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">All types adequately stocked</p>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Live data from the battery database. View full battery list on the{" "}
            <Link href="/batteries" className="underline">Batteries</Link> page.
          </p>
        </>
      )}
    </div>
  )
}
