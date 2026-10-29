"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type SaleRecord, getSalesByLocation, getSalesByBatteryType } from "@/lib/sales-report"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Building2 } from "lucide-react"
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from "recharts"

interface LocationReportProps {
  sales: SaleRecord[]
}

const COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777"]

// Locations come from the sales themselves (real DB locations), not a
// hardcoded Broadway/Camelback pair.
export function LocationReport({ sales }: LocationReportProps) {
  const salesByLocation = getSalesByLocation(sales)
  const totalUnits = Object.values(salesByLocation).reduce((sum, item) => sum + item.quantity, 0)
  const locationPieData = Object.entries(salesByLocation).map(([name, d]) => ({ name, value: d.quantity }))

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Sales by Location</CardTitle>
          <CardDescription>Units sold per location</CardDescription>
        </CardHeader>
        <CardContent>
          {locationPieData.length === 0 && (
            <p className="text-sm text-muted-foreground">No sales in this period.</p>
          )}
          <div className="space-y-6">
            {Object.entries(salesByLocation).map(([location, data]) => (
              <div key={location} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      <Building2 className="mr-1 h-3 w-3" />
                      {location}
                    </Badge>
                    <span className="text-sm font-medium">{data.quantity} units</span>
                  </div>
                  <span className="text-sm font-medium">${data.revenue.toLocaleString()}</span>
                </div>
                <Progress value={totalUnits ? (data.quantity / totalUnits) * 100 : 0} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Location Share</CardTitle>
          <CardDescription>Share of units sold</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={locationPieData} dataKey="value" nameKey="name" outerRadius={100} label>
                {locationPieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {Object.keys(salesByLocation).map((location) => {
        const byType = getSalesByBatteryType(sales.filter((s) => s.location === location))
        const data = Object.entries(byType)
          .filter(([, d]) => d.quantity > 0)
          .map(([name, d]) => ({ name, value: d.quantity }))
        return (
          <Card key={location}>
            <CardHeader>
              <CardTitle>{location} by Battery Type</CardTitle>
              <CardDescription>Units sold by type</CardDescription>
            </CardHeader>
            <CardContent className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" outerRadius={80} label>
                    {data.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
