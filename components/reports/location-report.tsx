"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type SaleRecord, getSalesByLocation, getSalesByBatteryType } from "@/lib/sales-data"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Building2 } from "lucide-react"
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from "recharts"

interface LocationReportProps {
  sales: SaleRecord[]
}

export function LocationReport({ sales }: LocationReportProps) {
  const salesByLocation = getSalesByLocation(sales)
  const totalCostOfGoods = Object.values(salesByLocation).reduce((sum, item) => sum + item.revenue, 0)

  // Get Broadway sales by battery type
  const broadwaySales = sales.filter((sale) => sale.location === "Broadway")
  const broadwaySalesByType = getSalesByBatteryType(broadwaySales)

  // Get Camelback sales by battery type
  const camelbackSales = sales.filter((sale) => sale.location === "Camelback")
  const camelbackSalesByType = getSalesByBatteryType(camelbackSales)

  // Prepare data for pie charts
  const locationPieData = [
    { name: "Broadway", value: salesByLocation.Broadway.revenue },
    { name: "Camelback", value: salesByLocation.Camelback.revenue },
  ]

  const broadwayPieData = [
    { name: "Alpha", value: broadwaySalesByType.Alpha.revenue },
    { name: "Bravo", value: broadwaySalesByType.Bravo.revenue },
    { name: "Charlie", value: broadwaySalesByType.Charlie.revenue },
    { name: "AMG", value: broadwaySalesByType.AMG.revenue },
  ]

  const camelbackPieData = [
    { name: "Alpha", value: camelbackSalesByType.Alpha.revenue },
    { name: "Bravo", value: camelbackSalesByType.Bravo.revenue },
    { name: "Charlie", value: camelbackSalesByType.Charlie.revenue },
    { name: "AMG", value: camelbackSalesByType.AMG.revenue },
  ]

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"]

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Sales by Location</CardTitle>
          <CardDescription>Revenue breakdown by location</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(salesByLocation).map(([location, data]) => (
              <div key={location} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={location === "Broadway" ? "bg-blue-50" : "bg-green-50"}>
                      <Building2 className="mr-1 h-3 w-3" />
                      {location}
                    </Badge>
                    <span className="text-sm font-medium">{data.quantity} units</span>
                  </div>
                  <span className="text-sm font-medium">${data.revenue.toLocaleString()}</span>
                </div>
                <Progress
                  value={(data.revenue / totalCostOfGoods) * 100}
                  className={location === "Broadway" ? "text-blue-500" : "text-green-500"}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{((data.revenue / totalCostOfGoods) * 100).toFixed(1)}% of total cost of goods</span>
                  <span>Avg. ${(data.revenue / data.quantity).toFixed(2)} per unit</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={locationPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {locationPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Battery Types by Location</CardTitle>
          <CardDescription>Breakdown of battery types sold at each location</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center">
                <Badge variant="outline" className="bg-blue-50 mr-2">
                  <Building2 className="mr-1 h-3 w-3" />
                  Broadway
                </Badge>
                Battery Sales
              </h3>
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={broadwayPieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {broadwayPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center">
                <Badge variant="outline" className="bg-green-50 mr-2">
                  <Building2 className="mr-1 h-3 w-3" />
                  Camelback
                </Badge>
                Battery Sales
              </h3>
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={camelbackPieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {camelbackPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
