"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, Building2, Truck, Battery, Package, Warehouse, RotateCcw, TrendingUp, AlertTriangle } from "lucide-react"
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

type SalesModel = { code: string; n: number }
type SalesLocation = {
  location_id: string | null
  location_name: string
  company_name: string | null
  total: number
  models: SalesModel[]
}
type SalesSummary = {
  success: boolean
  start: string
  end: string
  grandTotal: number
  locations: SalesLocation[]
}

const TYPE_ACCENT: Record<string, string> = {
  Alpha: "border-l-blue-600 text-blue-600",
  Bravo: "border-l-green-600 text-green-600",
  AMG: "border-l-red-600 text-red-600",
  Tesla: "border-l-purple-600 text-purple-600",
  Prius: "border-l-amber-600 text-amber-600",
}

// YYYY-MM-DD for an offset number of days from today (0 = today).
function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/* ---------- Loading skeletons ---------- */
/* These mirror the real layout so the page does not jump when data lands. */

function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading dashboard data…</span>

      {/* Four summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4">
              <SkeletonBar className="h-4 w-28" />
              <SkeletonBar className="h-5 w-5 rounded-full" />
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-3">
              <SkeletonBar className="h-7 w-16" />
              <SkeletonBar className="mt-2 h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* By Battery Type */}
      <div>
        <h2 className="text-xl font-semibold mb-3 mt-2">By Battery Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="shadow-sm border-l-4 border-l-muted">
              <CardHeader className="pb-2">
                <SkeletonBar className="h-5 w-24" />
              </CardHeader>
              <CardContent>
                <SkeletonBar className="h-8 w-12" />
                <SkeletonBar className="mt-3 h-3 w-full" />
                <SkeletonBar className="mt-2 h-3 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Returned cores */}
      <Card className="shadow-sm border-l-4 border-l-muted">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4">
          <SkeletonBar className="h-4 w-32" />
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-3">
          <SkeletonBar className="h-7 w-12" />
          <SkeletonBar className="mt-2 h-3 w-36" />
        </CardContent>
      </Card>
    </div>
  )
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [summaryError, setSummaryError] = useState("")

  // Units-sold section state
  const [startDate, setStartDate] = useState<string>(isoDaysAgo(30))
  const [endDate, setEndDate] = useState<string>(isoDaysAgo(0))
  const [sales, setSales] = useState<SalesSummary | null>(null)
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesError, setSalesError] = useState("")

  const loadSummary = useCallback(async () => {
    setIsLoading(true)
    setSummaryError("")
    try {
      const res = await fetch("/api/inventory/summary", { cache: "no-store" })
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`)
      }
      const j = await res.json()
      if (j?.success) {
        setSummary(j)
      } else {
        setSummary(null)
        setSummaryError(j?.error || "The inventory summary could not be loaded.")
      }
    } catch (err) {
      setSummary(null)
      setSummaryError(
        err instanceof Error ? err.message : "The inventory summary could not be loaded."
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  function loadSales() {
    if (!startDate || !endDate) {
      setSalesError("Pick both a start and end date.")
      return
    }
    if (startDate > endDate) {
      setSalesError("Start date must be on or before end date.")
      return
    }
    setSalesError("")
    setSalesLoading(true)
    fetch(`/api/sales/summary?start=${startDate}&end=${endDate}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.success) {
          setSales(j)
        } else {
          setSalesError(j?.error || "Could not load sales.")
          setSales(null)
        }
      })
      .catch(() => {
        setSalesError("Could not load sales.")
        setSales(null)
      })
      .finally(() => setSalesLoading(false))
  }

  // Load the default range once on mount.
  useEffect(() => {
    loadSales()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <h1 className="text-3xl font-bold tracking-tight">Dugger&apos;s Battery Program</h1>
        <div className="flex items-center gap-2">
          <Link href="/batteries/new">
            <Button className="text-base h-11">
              <PlusCircle className="mr-2 h-5 w-5" />
              Add Battery
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : summaryError ? (
        /* Real failure — never show zeros as if they were real numbers. */
        <Card className="shadow-sm border-l-4 border-l-red-600">
          <CardHeader className="flex flex-row items-center gap-2 py-4 px-4">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <CardTitle className="text-base font-medium">
              Inventory data unavailable
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <p className="text-sm text-muted-foreground">
              The dashboard could not reach the inventory summary, so the numbers below
              are being withheld rather than shown as zeros. Details: {summaryError}
            </p>
            <Button onClick={loadSummary} className="mt-3" variant="outline">
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
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

          {/* Units Sold — by date range, location, and battery model */}
          <div className="mt-2">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold tracking-tight">Units Sold</h2>
            </div>

            <Card className="shadow-sm">
              <CardContent className="pt-4 px-4 pb-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="grid gap-1">
                    <label htmlFor="sales-start" className="text-xs font-medium text-muted-foreground">From</label>
                    <Input
                      id="sales-start"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-[160px]"
                    />
                  </div>
                  <div className="grid gap-1">
                    <label htmlFor="sales-end" className="text-xs font-medium text-muted-foreground">To</label>
                    <Input
                      id="sales-end"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-[160px]"
                    />
                  </div>
                  <Button onClick={loadSales} disabled={salesLoading}>
                    {salesLoading ? "Loading…" : "Show units sold"}
                  </Button>
                  {sales ? (
                    <div className="ml-auto text-right">
                      <div className="text-2xl font-bold">{sales.grandTotal}</div>
                      <p className="text-xs text-muted-foreground">total units sold</p>
                    </div>
                  ) : null}
                </div>

                {salesError ? (
                  <p className="text-sm text-red-600 mt-3">{salesError}</p>
                ) : null}

                <div className="mt-4">
                  {salesLoading ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="rounded-md border p-4">
                          <SkeletonBar className="h-4 w-32" />
                          <SkeletonBar className="mt-2 h-3 w-24" />
                          <SkeletonBar className="mt-4 h-3 w-full" />
                        </div>
                      ))}
                    </div>
                  ) : !sales || sales.locations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No units sold in this date range.
                    </p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {sales.locations.map((loc) => (
                        <div
                          key={loc.location_id ?? loc.location_name}
                          className="rounded-md border p-4"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold">{loc.location_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {loc.company_name || "—"}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold">{loc.total}</div>
                              <p className="text-xs text-muted-foreground">units</p>
                            </div>
                          </div>
                          <div className="mt-3">
                            <p className="text-xs text-muted-foreground mb-1.5">By model</p>
                            <div className="flex flex-wrap gap-1.5">
                              {[...loc.models]
                                .sort((a, b) => b.n - a.n)
                                .map((m) => (
                                  <Badge key={m.code} variant="outline" className="text-xs">
                                    {m.code}: {m.n}
                                  </Badge>
                                ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground">
            Live data from the battery database. Full list on the{" "}
            <Link href="/batteries" className="underline">Batteries</Link> page;
            detailed breakdown on{" "}
            <Link href="/inventory" className="underline">Inventory</Link>.
          </p>
        </>
      )}
    </div>
  )
}
