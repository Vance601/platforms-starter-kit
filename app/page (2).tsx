"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  PlusCircle, Building2, Truck, Battery, Package, Warehouse, RotateCcw,
  TrendingUp, AlertTriangle, BarChart3,
} from "lucide-react"
import Link from "next/link"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, LabelList,
} from "recharts"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

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

type Charts = {
  success: boolean
  start: string | null
  end: string | null
  inventoryByStatus: { status: string; label: string; count: number }[]
  locationTypes: Record<string, string | number>[]
  typeNames: string[]
  movementFlow: { from: string; to: string; label: string; count: number }[]
  approvalBreakdown: { status: string; count: number }[]
  unitsSoldByMonth: { month: string; count: number }[]
  totals: {
    batteries: number
    movements: number
    unitsSold: number
    unitsSoldAllTime: number
    returnedCore: number
    orphanedBatteries: number
  }
}

const TYPE_ACCENT: Record<string, string> = {
  Alpha: "border-l-blue-600 text-blue-600",
  Bravo: "border-l-green-600 text-green-600",
  AMG: "border-l-red-600 text-red-600",
  Tesla: "border-l-purple-600 text-purple-600",
  Prius: "border-l-amber-600 text-amber-600",
}

// Chart palette. Status colours are meaningful; type colours match the
// accent bars used on the "By Battery Type" cards above.
const STATUS_FILL: Record<string, string> = {
  in_warehouse: "#059669",
  on_truck: "#d97706",
  sold: "#2563eb",
  returned_core: "#7c3aed",
}
const TYPE_FILL: Record<string, string> = {
  Alpha: "#2563eb",
  Bravo: "#16a34a",
  AMG: "#dc2626",
  Tesla: "#7c3aed",
  Prius: "#d97706",
}
const SERIES = ["#2563eb", "#16a34a", "#dc2626", "#7c3aed", "#d97706", "#0891b2", "#db2777"]

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/* ------------------------------------------------------------------ */
/* Error boundary                                                      */
/* ------------------------------------------------------------------ */
/* A chart library throwing must never take the whole dashboard down
   again. Anything that fails inside here degrades to a message. */

class ChartErrorBoundary extends React.Component<
  { children: React.ReactNode; label: string },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode; label: string }) {
    super(props)
    this.state = { hasError: false, message: "" }
  }
  static getDerivedStateFromError(err: unknown) {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : "Chart failed to render",
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-[280px] flex-col items-center justify-center gap-1 rounded-md border border-dashed p-4 text-center">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <p className="text-sm font-medium">{this.props.label} could not render</p>
          <p className="text-xs text-muted-foreground">{this.state.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
}

function EmptyChart({ note }: { note: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-md border border-dashed p-4">
      <p className="max-w-xs text-center text-sm text-muted-foreground">{note}</p>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading dashboard data…</span>
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
      <div>
        <h2 className="text-xl font-semibold mb-3 mt-2">By Battery Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="shadow-sm border-l-4 border-l-muted">
              <CardHeader className="pb-2"><SkeletonBar className="h-5 w-24" /></CardHeader>
              <CardContent>
                <SkeletonBar className="h-8 w-12" />
                <SkeletonBar className="mt-3 h-3 w-full" />
                <SkeletonBar className="mt-2 h-3 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
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

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

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

  // Analytics state. Empty strings mean "all time", which is the default
  // while the dataset is small enough that a 30-day window shows nothing.
  const [chartStart, setChartStart] = useState<string>("")
  const [chartEnd, setChartEnd] = useState<string>("")
  const [charts, setCharts] = useState<Charts | null>(null)
  const [chartsLoading, setChartsLoading] = useState(true)
  const [chartsError, setChartsError] = useState("")

  const loadSummary = useCallback(async () => {
    setIsLoading(true)
    setSummaryError("")
    try {
      const res = await fetch("/api/inventory/summary", { cache: "no-store" })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const j = await res.json()
      if (j?.success) {
        setSummary(j)
      } else {
        setSummary(null)
        setSummaryError(j?.error || "The inventory summary could not be loaded.")
      }
    } catch (err) {
      setSummary(null)
      setSummaryError(err instanceof Error ? err.message : "The inventory summary could not be loaded.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadCharts = useCallback(async (s: string, e: string) => {
    setChartsLoading(true)
    setChartsError("")
    try {
      const qs = new URLSearchParams()
      if (s) qs.set("start", s)
      if (e) qs.set("end", e)
      const url = `/api/dashboard/charts${qs.toString() ? `?${qs.toString()}` : ""}`
      const res = await fetch(url, { cache: "no-store" })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const j = await res.json()
      if (j?.success) {
        setCharts(j)
      } else {
        setCharts(null)
        setChartsError(j?.error || "Chart data could not be loaded.")
      }
    } catch (err) {
      setCharts(null)
      setChartsError(err instanceof Error ? err.message : "Chart data could not be loaded.")
    } finally {
      setChartsLoading(false)
    }
  }, [])

  useEffect(() => { loadSummary() }, [loadSummary])
  useEffect(() => { loadCharts("", "") }, [loadCharts])

  function applyRange(days: number | null) {
    if (days === null) {
      setChartStart("")
      setChartEnd("")
      loadCharts("", "")
    } else {
      const s = isoDaysAgo(days)
      const e = isoDaysAgo(0)
      setChartStart(s)
      setChartEnd(e)
      loadCharts(s, e)
    }
  }

  function loadSales() {
    if (!startDate || !endDate) { setSalesError("Pick both a start and end date."); return }
    if (startDate > endDate) { setSalesError("Start date must be on or before end date."); return }
    setSalesError("")
    setSalesLoading(true)
    fetch(`/api/sales/summary?start=${startDate}&end=${endDate}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.success) setSales(j)
        else { setSalesError(j?.error || "Could not load sales."); setSales(null) }
      })
      .catch(() => { setSalesError("Could not load sales."); setSales(null) })
      .finally(() => setSalesLoading(false))
  }

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

  const rangeLabel = chartStart || chartEnd ? `${chartStart || "start"} → ${chartEnd || "today"}` : "All time"

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
        <Card className="shadow-sm border-l-4 border-l-red-600">
          <CardHeader className="flex flex-row items-center gap-2 py-4 px-4">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <CardTitle className="text-base font-medium">Inventory data unavailable</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <p className="text-sm text-muted-foreground">
              The dashboard could not reach the inventory summary, so the numbers below
              are being withheld rather than shown as zeros. Details: {summaryError}
            </p>
            <Button onClick={loadSummary} className="mt-3" variant="outline">Try again</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
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

          {/* Returned cores */}
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

          {/* ---------------------------------------------------------- */}
          {/* Analytics                                                   */}
          {/* ---------------------------------------------------------- */}
          <div className="mt-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold tracking-tight">Analytics</h2>
              <Badge variant="outline" className="ml-1 text-xs font-normal">{rangeLabel}</Badge>
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant={!chartStart ? "default" : "outline"} onClick={() => applyRange(null)}>All time</Button>
                <Button size="sm" variant="outline" onClick={() => applyRange(7)}>7d</Button>
                <Button size="sm" variant="outline" onClick={() => applyRange(30)}>30d</Button>
                <Button size="sm" variant="outline" onClick={() => applyRange(90)}>90d</Button>
                <Input type="date" value={chartStart} onChange={(e) => setChartStart(e.target.value)} className="w-[150px]" aria-label="Analytics start date" />
                <Input type="date" value={chartEnd} onChange={(e) => setChartEnd(e.target.value)} className="w-[150px]" aria-label="Analytics end date" />
                <Button size="sm" onClick={() => loadCharts(chartStart, chartEnd)} disabled={chartsLoading}>
                  {chartsLoading ? "Loading…" : "Apply"}
                </Button>
              </div>
            </div>

            {charts && charts.totals.orphanedBatteries > 0 && (
              <Card className="mb-3 shadow-sm border-l-4 border-l-amber-500">
                <CardContent className="flex items-start gap-2 py-3 px-4">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {charts.totals.orphanedBatteries} batteries
                    </span>{" "}
                    are not linked to any company, so they are excluded from every chart
                    below. Worth reconciling.
                  </p>
                </CardContent>
              </Card>
            )}

            {chartsError ? (
              <Card className="shadow-sm border-l-4 border-l-red-600">
                <CardContent className="py-4 px-4">
                  <p className="text-sm text-muted-foreground">
                    Chart data unavailable: {chartsError}
                  </p>
                  <Button onClick={() => loadCharts(chartStart, chartEnd)} className="mt-3" variant="outline">
                    Try again
                  </Button>
                </CardContent>
              </Card>
            ) : chartsLoading ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <Card key={i} className="shadow-sm">
                    <CardHeader className="pb-2"><SkeletonBar className="h-5 w-40" /></CardHeader>
                    <CardContent><SkeletonBar className="h-[260px] w-full" /></CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {/* 1. Inventory by status */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">Inventory by status</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Current snapshot of all {charts?.totals.batteries ?? 0} batteries. Not affected by the date range.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ChartErrorBoundary label="Inventory by status">
                      {!charts || charts.inventoryByStatus.length === 0 ? (
                        <EmptyChart note="No batteries found for your organization." />
                      ) : (
                        <div className="h-[280px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={charts.inventoryByStatus} margin={{ top: 24, right: 8, left: 0, bottom: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                              <Tooltip cursor={{ fillOpacity: 0.1 }} />
                              <Bar dataKey="count" name="Batteries" radius={[4, 4, 0, 0]}>
                                <LabelList dataKey="count" position="top" fontSize={12} fill="#334155" />
                                {charts.inventoryByStatus.map((d) => (
                                  <Cell key={d.status} fill={STATUS_FILL[d.status] || "#64748b"} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </ChartErrorBoundary>
                  </CardContent>
                </Card>

                {/* 2. Inventory by location and type */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">Stock by location and type</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Current snapshot, stacked by battery type.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ChartErrorBoundary label="Stock by location">
                      {!charts || charts.locationTypes.length === 0 ? (
                        <EmptyChart note="No stock assigned to locations yet." />
                      ) : (
                        <div className="h-[280px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={charts.locationTypes} margin={{ top: 24, right: 8, left: 0, bottom: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="location" tick={{ fontSize: 12 }} />
                              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                              <Tooltip cursor={{ fillOpacity: 0.1 }} />
                              <Legend wrapperStyle={{ fontSize: 12 }} />
                              {charts.typeNames.map((t, i) => (
                                <Bar key={t} dataKey={t} stackId="a" name={t}
                                     fill={TYPE_FILL[t] || SERIES[i % SERIES.length]}>
                                  {i === charts.typeNames.length - 1 && (
                                    <LabelList dataKey="total" position="top" fontSize={12} fill="#334155" />
                                  )}
                                </Bar>
                              ))}
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </ChartErrorBoundary>
                  </CardContent>
                </Card>

                {/* 3. Movement flow */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">How stock moves</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {charts?.totals.movements ?? 0} movements in range, grouped by transition.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ChartErrorBoundary label="Movement flow">
                      {!charts || charts.movementFlow.length === 0 ? (
                        <EmptyChart note="No battery movements recorded in this date range. Try 'All time'." />
                      ) : (
                        <div className="h-[280px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={charts.movementFlow} layout="vertical"
                                      margin={{ top: 8, right: 44, left: 8, bottom: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                              <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 11 }} />
                              <Tooltip cursor={{ fillOpacity: 0.1 }} />
                              <Bar dataKey="count" name="Movements" fill="#2563eb" radius={[0, 4, 4, 0]}>
                                <LabelList dataKey="count" position="right" fontSize={12} fill="#334155" />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </ChartErrorBoundary>
                  </CardContent>
                </Card>

                {/* 4. Units sold by month */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">Units sold by month</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Counted from sold date, so cores returned after sale still count.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ChartErrorBoundary label="Units sold">
                      {!charts || charts.unitsSoldByMonth.length === 0 ? (
                        <EmptyChart note="No sales recorded in this date range. Try 'All time'." />
                      ) : (
                        <div className="h-[280px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={charts.unitsSoldByMonth} margin={{ top: 24, right: 8, left: 0, bottom: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                              <Tooltip cursor={{ fillOpacity: 0.1 }} />
                              <Bar dataKey="count" name="Units sold" fill="#16a34a" radius={[4, 4, 0, 0]}>
                                <LabelList dataKey="count" position="top" fontSize={12} fill="#334155" />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </ChartErrorBoundary>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Core-return rate, shown as a stat rather than a chart.
                At these volumes a percentage swings wildly, so the raw
                numerator and denominator are shown alongside it. */}
            {charts && !chartsLoading && !chartsError && (
              <Card className="mt-4 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">Core returns vs. sales</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap items-end gap-6">
                    <div>
                      <div className="text-2xl font-bold">{charts.totals.returnedCore}</div>
                      <p className="text-xs text-muted-foreground">cores returned</p>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{charts.totals.unitsSoldAllTime}</div>
                      <p className="text-xs text-muted-foreground">units sold, all time</p>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">
                        {charts.totals.unitsSoldAllTime > 0
                          ? `${Math.round((charts.totals.returnedCore / charts.totals.unitsSoldAllTime) * 100)}%`
                          : "—"}
                      </div>
                      <p className="text-xs text-muted-foreground">return rate</p>
                    </div>
                  </div>
                  {charts.totals.unitsSoldAllTime < 30 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Based on {charts.totals.unitsSoldAllTime} sales — too few for the percentage
                      to be stable. Treat it as a raw count until volume builds.
                    </p>
                  )}
                  {charts.approvalBreakdown.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-1.5 text-xs text-muted-foreground">Movement approval mix (in range)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {charts.approvalBreakdown.map((a) => (
                          <Badge key={a.status} variant="outline" className="text-xs">
                            {a.status}: {a.count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Units Sold detail */}
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
                    <Input id="sales-start" type="date" value={startDate}
                           onChange={(e) => setStartDate(e.target.value)} className="w-[160px]" />
                  </div>
                  <div className="grid gap-1">
                    <label htmlFor="sales-end" className="text-xs font-medium text-muted-foreground">To</label>
                    <Input id="sales-end" type="date" value={endDate}
                           onChange={(e) => setEndDate(e.target.value)} className="w-[160px]" />
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

                {salesError ? <p className="text-sm text-red-600 mt-3">{salesError}</p> : null}

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
                    <p className="text-sm text-muted-foreground">No units sold in this date range.</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {sales.locations.map((loc) => (
                        <div key={loc.location_id ?? loc.location_name} className="rounded-md border p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold">{loc.location_name}</p>
                              <p className="text-xs text-muted-foreground">{loc.company_name || "—"}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold">{loc.total}</div>
                              <p className="text-xs text-muted-foreground">units</p>
                            </div>
                          </div>
                          <div className="mt-3">
                            <p className="text-xs text-muted-foreground mb-1.5">By model</p>
                            <div className="flex flex-wrap gap-1.5">
                              {[...loc.models].sort((a, b) => b.n - a.n).map((m) => (
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
