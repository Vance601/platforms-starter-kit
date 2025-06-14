"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Download, DollarSign, FileText, PieChart } from "lucide-react"
import { ReconciliationReport } from "@/components/core-returns/reconciliation-report"
import { getReconciliationData, type ReconciliationSummary, type ReconciliationDetail } from "@/lib/core-returns-data"

export default function ReconciliationPage() {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [location, setLocation] = useState<string>("all")
  const [reportType, setReportType] = useState<"summary" | "detail">("summary")
  const [reconciliationData, setReconciliationData] = useState<{
    summary: ReconciliationSummary
    details: ReconciliationDetail[]
  }>({
    summary: {
      totalDeposits: 0,
      totalRefunds: 0,
      netBalance: 0,
      unreconciledCount: 0,
      reconciledCount: 0,
      reconciledDeposits: 0,
      reconciledRefunds: 0,
      unreconciledDeposits: 0,
      unreconciledRefunds: 0,
      byBatteryType: {
        Alpha: { deposits: 0, refunds: 0, netBalance: 0, count: 0 },
        Bravo: { deposits: 0, refunds: 0, netBalance: 0, count: 0 },
        Charlie: { deposits: 0, refunds: 0, netBalance: 0, count: 0 },
        AMG: { deposits: 0, refunds: 0, netBalance: 0, count: 0 },
      },
      byLocation: {
        Broadway: { deposits: 0, refunds: 0, netBalance: 0, count: 0 },
        Camelback: { deposits: 0, refunds: 0, netBalance: 0, count: 0 },
      },
    },
    details: [],
  })

  // Initialize dates to current month
  useEffect(() => {
    const end = new Date()
    const start = new Date(end.getFullYear(), end.getMonth(), 1) // First day of current month

    setEndDate(end.toISOString().split("T")[0])
    setStartDate(start.toISOString().split("T")[0])
  }, [])

  // Load reconciliation data when filters change
  useEffect(() => {
    if (startDate && endDate) {
      const data = getReconciliationData(startDate, endDate, location === "all" ? undefined : location)
      setReconciliationData(data)
    }
  }, [startDate, endDate, location])

  // Apply date filter
  const applyDateFilter = () => {
    if (startDate && endDate) {
      const data = getReconciliationData(startDate, endDate, location === "all" ? undefined : location)
      setReconciliationData(data)
    }
  }

  // Export to CSV
  const exportToCSV = () => {
    if (reconciliationData.details.length === 0) return

    let headers: string
    let csvContent: string

    if (reportType === "summary") {
      headers = "Category,Deposits,Refunds,Net Balance,Count\n"

      // Summary data
      const { summary } = reconciliationData
      csvContent = [
        `Total,${summary.totalDeposits.toFixed(2)},${summary.totalRefunds.toFixed(2)},${summary.netBalance.toFixed(2)},${summary.reconciledCount + summary.unreconciledCount}`,
        `Reconciled,${summary.reconciledDeposits.toFixed(2)},${summary.reconciledRefunds.toFixed(2)},${(summary.reconciledDeposits - summary.reconciledRefunds).toFixed(2)},${summary.reconciledCount}`,
        `Unreconciled,${summary.unreconciledDeposits.toFixed(2)},${summary.unreconciledRefunds.toFixed(2)},${(summary.unreconciledDeposits - summary.unreconciledRefunds).toFixed(2)},${summary.unreconciledCount}`,
        `\nBy Battery Type,,,`,
        `Alpha,${summary.byBatteryType.Alpha.deposits.toFixed(2)},${summary.byBatteryType.Alpha.refunds.toFixed(2)},${summary.byBatteryType.Alpha.netBalance.toFixed(2)},${summary.byBatteryType.Alpha.count}`,
        `Bravo,${summary.byBatteryType.Bravo.deposits.toFixed(2)},${summary.byBatteryType.Bravo.refunds.toFixed(2)},${summary.byBatteryType.Bravo.netBalance.toFixed(2)},${summary.byBatteryType.Bravo.count}`,
        `Charlie,${summary.byBatteryType.Charlie.deposits.toFixed(2)},${summary.byBatteryType.Charlie.refunds.toFixed(2)},${summary.byBatteryType.Charlie.netBalance.toFixed(2)},${summary.byBatteryType.Charlie.count}`,
        `AMG,${summary.byBatteryType.AMG.deposits.toFixed(2)},${summary.byBatteryType.AMG.refunds.toFixed(2)},${summary.byBatteryType.AMG.netBalance.toFixed(2)},${summary.byBatteryType.AMG.count}`,
        `\nBy Location,,,`,
        `Broadway,${summary.byLocation.Broadway.deposits.toFixed(2)},${summary.byLocation.Broadway.refunds.toFixed(2)},${summary.byLocation.Broadway.netBalance.toFixed(2)},${summary.byLocation.Broadway.count}`,
        `Camelback,${summary.byLocation.Camelback.deposits.toFixed(2)},${summary.byLocation.Camelback.refunds.toFixed(2)},${summary.byLocation.Camelback.netBalance.toFixed(2)},${summary.byLocation.Camelback.count}`,
      ].join("\n")
    } else {
      // Detailed report
      headers =
        "ID,Date Distributed,Date Returned,Team Member,Battery Type,Location,Quantity,Deposit Amount,Refund Amount,Net Balance,Status,Notes\n"
      csvContent = reconciliationData.details
        .map(
          (detail) =>
            `${detail.id},${detail.dateDistributed},${detail.dateReturned || "N/A"},${detail.teamMemberName},${detail.batteryType},${detail.location},${detail.quantity},${detail.depositAmount.toFixed(2)},${detail.refundAmount.toFixed(2)},${detail.netBalance.toFixed(2)},${detail.status},${detail.notes.replace(/,/g, ";")}`,
        )
        .join("\n")
    }

    const blob = new Blob([headers + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `core-reconciliation-${startDate}-to-${endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Core Returns Reconciliation</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
          <CardDescription>Select date range and filters for your reconciliation report</CardDescription>
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
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger id="location" className="w-[180px]">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  <SelectItem value="Broadway">Broadway</SelectItem>
                  <SelectItem value="Camelback">Camelback</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportType">Report Type</Label>
              <Select value={reportType} onValueChange={(value: "summary" | "detail") => setReportType(value)}>
                <SelectTrigger id="reportType" className="w-[180px]">
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Summary Report</SelectItem>
                  <SelectItem value="detail">Detailed Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={applyDateFilter}>
              <Calendar className="mr-2 h-4 w-4" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {reconciliationData.summary.totalDeposits.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">Core deposits collected from customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Refunds</CardTitle>
            <DollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {reconciliationData.summary.totalRefunds.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">Core refunds issued to customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {reconciliationData.summary.netBalance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">Net balance of deposits minus refunds</p>
          </CardContent>
        </Card>
      </div>

      <Tabs
        defaultValue="summary"
        value={reportType}
        onValueChange={(value: string) => setReportType(value as "summary" | "detail")}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="summary">
            <PieChart className="mr-2 h-4 w-4" />
            Summary Report
          </TabsTrigger>
          <TabsTrigger value="detail">
            <FileText className="mr-2 h-4 w-4" />
            Detailed Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6">
          <ReconciliationReport
            data={reconciliationData}
            reportType="summary"
            dateRange={{ startDate, endDate }}
            location={location === "all" ? undefined : location}
          />
        </TabsContent>

        <TabsContent value="detail" className="mt-6">
          <ReconciliationReport
            data={reconciliationData}
            reportType="detail"
            dateRange={{ startDate, endDate }}
            location={location === "all" ? undefined : location}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
