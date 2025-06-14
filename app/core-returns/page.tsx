"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, Download, AlertTriangle, CheckCircle, Battery, PlusCircle } from "lucide-react"
import {
  type CoreReturn,
  getCoreReturnsData,
  filterReturnsByDateRange,
  getMissingCoresReport,
} from "@/lib/core-returns-data"
import { RecordCoreReturnModal } from "@/components/core-returns/record-core-return-modal"
import { MissingCoresReport } from "@/components/core-returns/missing-cores-report"
import { CoreReturnsTable } from "@/components/core-returns/core-returns-table"
import { UnreconciledDistributionsTable } from "@/components/core-returns/unreconciled-distributions-table"

export default function CoreReturnsPage() {
  const [coreReturns, setCoreReturns] = useState<CoreReturn[]>([])
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [filteredReturns, setFilteredReturns] = useState<CoreReturn[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  // Initialize dates to last 30 days
  useEffect(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)

    setEndDate(end.toISOString().split("T")[0])
    setStartDate(start.toISOString().split("T")[0])
  }, [])

  // Load core returns data
  useEffect(() => {
    const data = getCoreReturnsData()
    setCoreReturns(data)
  }, [])

  // Filter returns when date range changes
  useEffect(() => {
    if (startDate && endDate && coreReturns.length > 0) {
      const filtered = filterReturnsByDateRange(coreReturns, startDate, endDate)
      setFilteredReturns(filtered)
    }
  }, [startDate, endDate, coreReturns])

  // Calculate statistics
  const totalReturns = filteredReturns.length
  const fullyReturned = filteredReturns.filter((ret) => ret.status === "Fully Returned").length
  const partiallyReturned = filteredReturns.filter((ret) => ret.status === "Partially Returned").length
  const notReturned = filteredReturns.filter((ret) => ret.status === "Not Returned").length

  // Get missing cores report
  const missingCoresReport = getMissingCoresReport(filteredReturns)

  // Handle date range changes
  const applyDateFilter = () => {
    if (startDate && endDate) {
      const filtered = filterReturnsByDateRange(coreReturns, startDate, endDate)
      setFilteredReturns(filtered)
    }
  }

  // Handle export to CSV
  const exportToCSV = () => {
    if (filteredReturns.length === 0) return

    const headers =
      "ID,Sale ID,Team Member,Truck,Battery Type,Distributed,Returned,Missing,Date Distributed,Date Returned,Location,Status,Notes\n"
    const csvContent = filteredReturns
      .map(
        (ret) =>
          `${ret.id},${ret.saleId},${ret.teamMemberName},${ret.truckNumber},${ret.batteryType},${ret.quantityDistributed},${ret.quantityReturned},${ret.quantityDistributed - ret.quantityReturned},${ret.dateDistributed},${ret.dateReturned},${ret.location},${ret.status},"${ret.notes}"`,
      )
      .join("\n")

    const blob = new Blob([headers + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `core-returns-${startDate}-to-${endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Handle new core return submission
  const handleCoreReturnAdded = () => {
    // Reload data
    const data = getCoreReturnsData()
    setCoreReturns(data)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Core Returns</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Record Core Return
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
          <CardDescription>Select a date range for your report</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Button onClick={applyDateFilter}>
              <Calendar className="mr-2 h-4 w-4" />
              Apply Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Returns</CardTitle>
            <Battery className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReturns}</div>
            <p className="text-xs text-muted-foreground">
              During selected period ({startDate} to {endDate})
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fully Returned</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fullyReturned}</div>
            <p className="text-xs text-muted-foreground">
              {((fullyReturned / totalReturns) * 100).toFixed(1)}% of total returns
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partially Returned</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partiallyReturned}</div>
            <p className="text-xs text-muted-foreground">
              {((partiallyReturned / totalReturns) * 100).toFixed(1)}% of total returns
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Not Returned</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notReturned}</div>
            <p className="text-xs text-muted-foreground">
              {((notReturned / totalReturns) * 100).toFixed(1)}% of total returns
            </p>
          </CardContent>
        </Card>
      </div>

      {missingCoresReport.total > 0 && (
        <Card className="border-destructive">
          <CardHeader className="bg-destructive/10">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle>Missing Cores Alert</CardTitle>
            </div>
            <CardDescription>
              There are {missingCoresReport.total} missing cores that need to be reconciled
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <MissingCoresReport report={missingCoresReport} />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="all-returns" className="w-full">
        <TabsList>
          <TabsTrigger value="all-returns">
            <Battery className="mr-2 h-4 w-4" />
            All Returns
          </TabsTrigger>
          <TabsTrigger value="missing-cores">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Missing Cores
          </TabsTrigger>
          <TabsTrigger value="unreconciled">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Unreconciled Distributions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all-returns" className="mt-6">
          <CoreReturnsTable returns={filteredReturns} />
        </TabsContent>

        <TabsContent value="missing-cores" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Missing Cores Report</CardTitle>
              <CardDescription>Detailed breakdown of missing cores by team member and truck</CardDescription>
            </CardHeader>
            <CardContent>
              {missingCoresReport.total > 0 ? (
                <MissingCoresReport report={missingCoresReport} detailed />
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-medium">No Missing Cores</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    All cores have been properly returned during the selected period.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unreconciled" className="mt-6">
          <UnreconciledDistributionsTable />
        </TabsContent>
      </Tabs>

      <RecordCoreReturnModal open={modalOpen} onOpenChange={setModalOpen} onCoreReturnAdded={handleCoreReturnAdded} />
    </div>
  )
}
