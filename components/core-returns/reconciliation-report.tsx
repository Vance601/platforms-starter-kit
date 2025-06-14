"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts"
import { Building2, Battery, User, Calendar, Search } from "lucide-react"
import type { ReconciliationSummary, ReconciliationDetail } from "@/lib/core-returns-data"

interface ReconciliationReportProps {
  data: {
    summary: ReconciliationSummary
    details: ReconciliationDetail[]
  }
  reportType: "summary" | "detail"
  dateRange: {
    startDate: string
    endDate: string
  }
  location?: string
}

export function ReconciliationReport({ data, reportType, dateRange, location }: ReconciliationReportProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [chartType, setChartType] = useState<"bar" | "pie" | "line">("bar")

  // Colors for charts
  const COLORS = {
    deposits: "#22c55e", // green-500
    refunds: "#ef4444", // red-500
    net: "#3b82f6", // blue-500
    alpha: "#60a5fa", // blue-400
    bravo: "#4ade80", // green-400
    charlie: "#fbbf24", // amber-400
    amg: "#a78bfa", // purple-400
    broadway: "#0ea5e9", // sky-500
    camelback: "#10b981", // emerald-500
  }

  // Format currency
  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Prepare data for charts
  const prepareFinancialData = () => {
    return [
      { name: "Deposits", value: data.summary.totalDeposits, color: COLORS.deposits },
      { name: "Refunds", value: data.summary.totalRefunds, color: COLORS.refunds },
      { name: "Net Balance", value: data.summary.netBalance, color: COLORS.net },
    ]
  }

  const prepareBatteryTypeData = () => {
    // Make sure byBatteryType and all its properties exist
    const byBatteryType = data?.summary?.byBatteryType || {}

    return [
      {
        name: "Alpha",
        deposits: byBatteryType?.Alpha?.deposits || 0,
        refunds: byBatteryType?.Alpha?.refunds || 0,
        net: byBatteryType?.Alpha?.netBalance || 0,
        count: byBatteryType?.Alpha?.count || 0,
        color: COLORS.alpha,
      },
      {
        name: "Bravo",
        deposits: byBatteryType?.Bravo?.deposits || 0,
        refunds: byBatteryType?.Bravo?.refunds || 0,
        net: byBatteryType?.Bravo?.netBalance || 0,
        count: byBatteryType?.Bravo?.count || 0,
        color: COLORS.bravo,
      },
      {
        name: "Charlie",
        deposits: byBatteryType?.Charlie?.deposits || 0,
        refunds: byBatteryType?.Charlie?.refunds || 0,
        net: byBatteryType?.Charlie?.netBalance || 0,
        count: byBatteryType?.Charlie?.count || 0,
        color: COLORS.charlie,
      },
      {
        name: "AMG",
        deposits: byBatteryType?.AMG?.deposits || 0,
        refunds: byBatteryType?.AMG?.refunds || 0,
        net: byBatteryType?.AMG?.netBalance || 0,
        count: byBatteryType?.AMG?.count || 0,
        color: COLORS.amg,
      },
    ]
  }

  const prepareLocationData = () => {
    // Make sure byLocation and all its properties exist
    const byLocation = data?.summary?.byLocation || {}

    return [
      {
        name: "Broadway",
        deposits: byLocation?.Broadway?.deposits || 0,
        refunds: byLocation?.Broadway?.refunds || 0,
        net: byLocation?.Broadway?.netBalance || 0,
        count: byLocation?.Broadway?.count || 0,
        color: COLORS.broadway,
      },
      {
        name: "Camelback",
        deposits: byLocation?.Camelback?.deposits || 0,
        refunds: byLocation?.Camelback?.refunds || 0,
        net: byLocation?.Camelback?.netBalance || 0,
        count: byLocation?.Camelback?.count || 0,
        color: COLORS.camelback,
      },
    ]
  }

  // Filter details based on search term
  const filteredDetails = data.details.filter((detail) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      detail.id.toLowerCase().includes(searchLower) ||
      detail.teamMemberName.toLowerCase().includes(searchLower) ||
      detail.batteryType.toLowerCase().includes(searchLower) ||
      detail.location.toLowerCase().includes(searchLower) ||
      detail.status.toLowerCase().includes(searchLower)
    )
  })

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-md shadow-md">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}`} style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "Fully Reconciled":
        return "default"
      case "Partially Reconciled":
        return "warning"
      case "Unreconciled":
        return "destructive"
      default:
        return "outline"
    }
  }

  // Get battery badge class
  const getBatteryBadgeClass = (type: string) => {
    switch (type) {
      case "Alpha":
        return "bg-blue-50"
      case "Bravo":
        return "bg-green-50"
      case "Charlie":
        return "bg-amber-50"
      case "AMG":
        return "bg-purple-50"
      default:
        return ""
    }
  }

  if (reportType === "summary") {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Financial Summary</h2>
          <Tabs
            value={chartType}
            onValueChange={(value: string) => setChartType(value as "bar" | "pie" | "line")}
            className="w-auto"
          >
            <TabsList className="h-8">
              <TabsTrigger value="bar" className="text-xs px-2 py-1">
                <BarChart className="h-3 w-3 mr-1" />
                Bar
              </TabsTrigger>
              <TabsTrigger value="pie" className="text-xs px-2 py-1">
                <PieChart className="h-3 w-3 mr-1" />
                Pie
              </TabsTrigger>
              <TabsTrigger value="line" className="text-xs px-2 py-1">
                <LineChart className="h-3 w-3 mr-1" />
                Line
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Financial Overview</CardTitle>
              <CardDescription>Deposits, refunds, and net balance</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "bar" ? (
                  <BarChart data={prepareFinancialData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="value" name="Amount" fill="#8884d8">
                      {prepareFinancialData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : chartType === "pie" ? (
                  <PieChart>
                    <Pie
                      data={prepareFinancialData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {prepareFinancialData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Legend />
                  </PieChart>
                ) : (
                  <LineChart data={prepareFinancialData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="value" name="Amount" stroke="#8884d8" />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By Battery Type</CardTitle>
              <CardDescription>Financial breakdown by battery type</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "bar" ? (
                  <BarChart data={prepareBatteryTypeData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Legend />
                    <Bar dataKey="deposits" name="Deposits" fill={COLORS.deposits} />
                    <Bar dataKey="refunds" name="Refunds" fill={COLORS.refunds} />
                    <Bar dataKey="net" name="Net Balance" fill={COLORS.net} />
                  </BarChart>
                ) : chartType === "pie" ? (
                  <PieChart>
                    <Pie
                      data={prepareBatteryTypeData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="net"
                    >
                      {prepareBatteryTypeData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Legend />
                  </PieChart>
                ) : (
                  <LineChart data={prepareBatteryTypeData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Legend />
                    <Line type="monotone" dataKey="deposits" name="Deposits" stroke={COLORS.deposits} />
                    <Line type="monotone" dataKey="refunds" name="Refunds" stroke={COLORS.refunds} />
                    <Line type="monotone" dataKey="net" name="Net Balance" stroke={COLORS.net} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reconciliation Summary</CardTitle>
            <CardDescription>
              Financial summary for {dateRange.startDate} to {dateRange.endDate}
              {location && ` at ${location}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">Category</th>
                    <th className="p-3 text-right font-medium">Deposits</th>
                    <th className="p-3 text-right font-medium">Refunds</th>
                    <th className="p-3 text-right font-medium">Net Balance</th>
                    <th className="p-3 text-right font-medium">Count</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b font-medium">
                    <td className="p-3">Total</td>
                    <td className="p-3 text-right text-green-600">{formatCurrency(data.summary.totalDeposits)}</td>
                    <td className="p-3 text-right text-red-600">{formatCurrency(data.summary.totalRefunds)}</td>
                    <td className="p-3 text-right text-blue-600">{formatCurrency(data.summary.netBalance)}</td>
                    <td className="p-3 text-right">{data.summary.reconciledCount + data.summary.unreconciledCount}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">Reconciled</td>
                    <td className="p-3 text-right text-green-600">{formatCurrency(data.summary.reconciledDeposits)}</td>
                    <td className="p-3 text-right text-red-600">{formatCurrency(data.summary.reconciledRefunds)}</td>
                    <td className="p-3 text-right text-blue-600">
                      {formatCurrency(data.summary.reconciledDeposits - data.summary.reconciledRefunds)}
                    </td>
                    <td className="p-3 text-right">{data.summary.reconciledCount}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">Unreconciled</td>
                    <td className="p-3 text-right text-green-600">
                      {formatCurrency(data.summary.unreconciledDeposits)}
                    </td>
                    <td className="p-3 text-right text-red-600">{formatCurrency(data.summary.unreconciledRefunds)}</td>
                    <td className="p-3 text-right text-blue-600">
                      {formatCurrency(data.summary.unreconciledDeposits - data.summary.unreconciledRefunds)}
                    </td>
                    <td className="p-3 text-right">{data.summary.unreconciledCount}</td>
                  </tr>
                  <tr className="border-b bg-muted/30">
                    <td colSpan={5} className="p-2 font-medium">
                      By Battery Type
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">
                      <Badge variant="outline" className="bg-blue-50">
                        <Battery className="mr-1 h-3 w-3" />
                        Alpha
                      </Badge>
                    </td>
                    <td className="p-3 text-right text-green-600">
                      {formatCurrency(data?.summary?.byBatteryType?.Alpha?.deposits || 0)}
                    </td>
                    <td className="p-3 text-right text-red-600">
                      {formatCurrency(data?.summary?.byBatteryType?.Alpha?.refunds || 0)}
                    </td>
                    <td className="p-3 text-right text-blue-600">
                      {formatCurrency(data?.summary?.byBatteryType?.Alpha?.netBalance || 0)}
                    </td>
                    <td className="p-3 text-right">{data?.summary?.byBatteryType?.Alpha?.count || 0}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">
                      <Badge variant="outline" className="bg-green-50">
                        <Battery className="mr-1 h-3 w-3" />
                        Bravo
                      </Badge>
                    </td>
                    <td className="p-3 text-right text-green-600">
                      {formatCurrency(data?.summary?.byBatteryType?.Bravo?.deposits || 0)}
                    </td>
                    <td className="p-3 text-right text-red-600">
                      {formatCurrency(data?.summary?.byBatteryType?.Bravo?.refunds || 0)}
                    </td>
                    <td className="p-3 text-right text-blue-600">
                      {formatCurrency(data?.summary?.byBatteryType?.Bravo?.netBalance || 0)}
                    </td>
                    <td className="p-3 text-right">{data?.summary?.byBatteryType?.Bravo?.count || 0}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">
                      <Badge variant="outline" className="bg-amber-50">
                        <Battery className="mr-1 h-3 w-3" />
                        Charlie
                      </Badge>
                    </td>
                    <td className="p-3 text-right text-green-600">
                      {formatCurrency(data?.summary?.byBatteryType?.Charlie?.deposits || 0)}
                    </td>
                    <td className="p-3 text-right text-red-600">
                      {formatCurrency(data?.summary?.byBatteryType?.Charlie?.refunds || 0)}
                    </td>
                    <td className="p-3 text-right text-blue-600">
                      {formatCurrency(data?.summary?.byBatteryType?.Charlie?.netBalance || 0)}
                    </td>
                    <td className="p-3 text-right">{data?.summary?.byBatteryType?.Charlie?.count || 0}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">
                      <Badge variant="outline" className="bg-purple-50">
                        <Battery className="mr-1 h-3 w-3" />
                        AMG
                      </Badge>
                    </td>
                    <td className="p-3 text-right text-green-600">
                      {formatCurrency(data?.summary?.byBatteryType?.AMG?.deposits || 0)}
                    </td>
                    <td className="p-3 text-right text-red-600">
                      {formatCurrency(data?.summary?.byBatteryType?.AMG?.refunds || 0)}
                    </td>
                    <td className="p-3 text-right text-blue-600">
                      {formatCurrency(data?.summary?.byBatteryType?.AMG?.netBalance || 0)}
                    </td>
                    <td className="p-3 text-right">{data?.summary?.byBatteryType?.AMG?.count || 0}</td>
                  </tr>
                  <tr className="border-b bg-muted/30">
                    <td colSpan={5} className="p-2 font-medium">
                      By Location
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">
                      <Badge variant="outline" className="bg-blue-50">
                        <Building2 className="mr-1 h-3 w-3" />
                        Broadway
                      </Badge>
                    </td>
                    <td className="p-3 text-right text-green-600">
                      {formatCurrency(data?.summary?.byLocation?.Broadway?.deposits || 0)}
                    </td>
                    <td className="p-3 text-right text-red-600">
                      {formatCurrency(data?.summary?.byLocation?.Broadway?.refunds || 0)}
                    </td>
                    <td className="p-3 text-right text-blue-600">
                      {formatCurrency(data?.summary?.byLocation?.Broadway?.netBalance || 0)}
                    </td>
                    <td className="p-3 text-right">{data?.summary?.byLocation?.Broadway?.count || 0}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">
                      <Badge variant="outline" className="bg-green-50">
                        <Building2 className="mr-1 h-3 w-3" />
                        Camelback
                      </Badge>
                    </td>
                    <td className="p-3 text-right text-green-600">
                      {formatCurrency(data?.summary?.byLocation?.Camelback?.deposits || 0)}
                    </td>
                    <td className="p-3 text-right text-red-600">
                      {formatCurrency(data?.summary?.byLocation?.Camelback?.refunds || 0)}
                    </td>
                    <td className="p-3 text-right text-blue-600">
                      {formatCurrency(data?.summary?.byLocation?.Camelback?.netBalance || 0)}
                    </td>
                    <td className="p-3 text-right">{data?.summary?.byLocation?.Camelback?.count || 0}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  } else {
    // Detailed report
    return (
      <Card>
        <CardHeader>
          <CardTitle>Detailed Reconciliation Report</CardTitle>
          <CardDescription>
            Complete list of all core returns for {dateRange.startDate} to {dateRange.endDate}
            {location && ` at ${location}`}
          </CardDescription>
          <div className="relative mt-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ID, team member, battery type..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">ID</th>
                  <th className="p-3 text-left font-medium">Date</th>
                  <th className="p-3 text-left font-medium">Team Member</th>
                  <th className="p-3 text-left font-medium">Battery Type</th>
                  <th className="p-3 text-left font-medium">Location</th>
                  <th className="p-3 text-right font-medium">Quantity</th>
                  <th className="p-3 text-right font-medium">Deposit</th>
                  <th className="p-3 text-right font-medium">Refund</th>
                  <th className="p-3 text-right font-medium">Net</th>
                  <th className="p-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDetails.length > 0 ? (
                  filteredDetails.map((detail) => (
                    <tr key={detail.id} className="border-b">
                      <td className="p-3 font-medium">{detail.id}</td>
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">Distributed:</span>
                          <span>{detail.dateDistributed}</span>
                          {detail.dateReturned && (
                            <>
                              <span className="text-xs text-muted-foreground mt-1">Returned:</span>
                              <span>{detail.dateReturned}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span>{detail.teamMemberName}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={getBatteryBadgeClass(detail.batteryType)}>
                          <Battery className="mr-1 h-3 w-3" />
                          {detail.batteryType}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={detail.location === "Broadway" ? "bg-blue-50" : "bg-green-50"}
                        >
                          <Building2 className="mr-1 h-3 w-3" />
                          {detail.location}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">{detail.quantity}</td>
                      <td className="p-3 text-right text-green-600">{formatCurrency(detail.depositAmount)}</td>
                      <td className="p-3 text-right text-red-600">{formatCurrency(detail.refundAmount)}</td>
                      <td className="p-3 text-right text-blue-600">{formatCurrency(detail.netBalance)}</td>
                      <td className="p-3">
                        <Badge variant={getStatusBadgeVariant(detail.status)}>{detail.status}</Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="p-8 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Calendar className="h-8 w-8 text-muted-foreground mb-2" />
                        <h3 className="text-lg font-medium">No Records Found</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          No core returns match your search criteria.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {filteredDetails.length > 0 && (
              <div className="p-3 text-center text-sm text-muted-foreground">
                Showing {filteredDetails.length} of {data.details.length} records
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }
}
