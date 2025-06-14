"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { BarChart, FileText, Download, Calendar, Building2, Users, Battery } from "lucide-react"
import { type SaleRecord, getSalesData, filterSalesByDateRange, getMonthlySalesData } from "@/lib/sales-data"
import { BatteryTypeReport } from "@/components/reports/battery-type-report"
import { TeamMemberReport } from "@/components/reports/team-member-report"
import { LocationReport } from "@/components/reports/location-report"
import { SalesOverviewChart } from "@/components/reports/sales-overview-chart"

export default function ReportsPage() {
  const [salesData, setSalesData] = useState<SaleRecord[]>([])
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [filteredSales, setFilteredSales] = useState<SaleRecord[]>([])

  // Initialize dates to last 30 days
  useEffect(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)

    setEndDate(end.toISOString().split("T")[0])
    setStartDate(start.toISOString().split("T")[0])
  }, [])

  // Load sales data
  useEffect(() => {
    const data = getSalesData()
    setSalesData(data)
  }, [])

  // Filter sales when date range changes
  useEffect(() => {
    if (startDate && endDate && salesData.length > 0) {
      const filtered = filterSalesByDateRange(salesData, startDate, endDate)
      setFilteredSales(filtered)
    }
  }, [startDate, endDate, salesData])

  // Calculate totals
  const totalSales = filteredSales.reduce((sum, sale) => sum + sale.quantity, 0)
  const totalCostOfGoods = filteredSales.reduce((sum, sale) => sum + sale.price, 0)

  // Handle date range changes
  const applyDateFilter = () => {
    if (startDate && endDate) {
      const filtered = filterSalesByDateRange(salesData, startDate, endDate)
      setFilteredSales(filtered)
    }
  }

  // Handle export to CSV
  const exportToCSV = () => {
    if (filteredSales.length === 0) return

    const headers = "ID,Date,Battery Type,Quantity,Price,Team Member,Location\n"
    const csvContent = filteredSales
      .map(
        (sale) =>
          `${sale.id},${sale.date},${sale.batteryType},${sale.quantity},${sale.price},${sale.teamMemberName},${sale.location}`,
      )
      .join("\n")

    const blob = new Blob([headers + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `battery-sales-${startDate}-to-${endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Sales Reports</h1>
        <Button variant="outline" onClick={exportToCSV}>
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Date Range</CardTitle>
          <CardDescription>Select a date range for your report</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
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

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Batteries Sold</CardTitle>
            <Battery className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSales}</div>
            <p className="text-xs text-muted-foreground">
              During selected period ({startDate} to {endDate})
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost of Goods</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCostOfGoods.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              During selected period ({startDate} to {endDate})
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Broadway Sales</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredSales.filter((sale) => sale.location === "Broadway").length}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredSales
                .filter((sale) => sale.location === "Broadway")
                .reduce((sum, sale) => sum + sale.quantity, 0)}{" "}
              batteries
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Camelback Sales</CardTitle>
            <Building2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredSales.filter((sale) => sale.location === "Camelback").length}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredSales
                .filter((sale) => sale.location === "Camelback")
                .reduce((sum, sale) => sum + sale.quantity, 0)}{" "}
              batteries
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardContent className="p-0">
          <SalesOverviewChart data={getMonthlySalesData(filteredSales)} />
        </CardContent>
      </Card>

      <Tabs defaultValue="battery-type" className="w-full">
        <TabsList>
          <TabsTrigger value="battery-type">
            <Battery className="mr-2 h-4 w-4" />
            By Battery Type
          </TabsTrigger>
          <TabsTrigger value="team-member">
            <Users className="mr-2 h-4 w-4" />
            By Team Member
          </TabsTrigger>
          <TabsTrigger value="location">
            <Building2 className="mr-2 h-4 w-4" />
            By Location
          </TabsTrigger>
          <TabsTrigger value="detailed">
            <FileText className="mr-2 h-4 w-4" />
            Detailed Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="battery-type" className="mt-4">
          <BatteryTypeReport sales={filteredSales} />
        </TabsContent>

        <TabsContent value="team-member" className="mt-4">
          <TeamMemberReport sales={filteredSales} />
        </TabsContent>

        <TabsContent value="location" className="mt-4">
          <LocationReport sales={filteredSales} />
        </TabsContent>

        <TabsContent value="detailed" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Sales Report</CardTitle>
              <CardDescription>Complete list of all sales during the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Date</th>
                      <th className="p-3 text-left font-medium">ID</th>
                      <th className="p-3 text-left font-medium">Battery Type</th>
                      <th className="p-3 text-left font-medium">Quantity</th>
                      <th className="p-3 text-left font-medium">Price</th>
                      <th className="p-3 text-left font-medium">Team Member</th>
                      <th className="p-3 text-left font-medium">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.slice(0, 100).map((sale) => (
                      <tr key={sale.id} className="border-b">
                        <td className="p-3">{sale.date}</td>
                        <td className="p-3 font-medium">{sale.id}</td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={
                              sale.batteryType === "Alpha"
                                ? "bg-blue-50"
                                : sale.batteryType === "Bravo"
                                  ? "bg-green-50"
                                  : sale.batteryType === "Charlie"
                                    ? "bg-amber-50"
                                    : "bg-purple-50"
                            }
                          >
                            {sale.batteryType}
                          </Badge>
                        </td>
                        <td className="p-3">{sale.quantity}</td>
                        <td className="p-3">${sale.price.toLocaleString()}</td>
                        <td className="p-3">{sale.teamMemberName}</td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={sale.location === "Broadway" ? "bg-blue-50" : "bg-green-50"}
                          >
                            <Building2 className="mr-1 h-3 w-3" />
                            {sale.location}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredSales.length > 100 && (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    Showing 100 of {filteredSales.length} records. Export to CSV to see all records.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
