"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type SaleRecord, getSalesByBatteryType } from "@/lib/sales-data"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Battery } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface BatteryTypeReportProps {
  sales: SaleRecord[]
}

export function BatteryTypeReport({ sales }: BatteryTypeReportProps) {
  const salesByType = getSalesByBatteryType(sales)
  const totalQuantity = Object.values(salesByType).reduce((sum, item) => sum + item.quantity, 0)
  const totalCostOfGoods = Object.values(salesByType).reduce((sum, item) => sum + item.revenue, 0)

  // Prepare data for chart
  const chartData = [
    { name: "Alpha", quantity: salesByType.Alpha.quantity, costOfGoods: salesByType.Alpha.revenue },
    { name: "Bravo", quantity: salesByType.Bravo.quantity, costOfGoods: salesByType.Bravo.revenue },
    { name: "Charlie", quantity: salesByType.Charlie.quantity, costOfGoods: salesByType.Charlie.revenue },
    { name: "AMG", quantity: salesByType.AMG.quantity, costOfGoods: salesByType.AMG.revenue },
  ]

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

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Battery Sales by Type</CardTitle>
          <CardDescription>Quantity and revenue breakdown by battery type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(salesByType).map(([type, data]) => (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getBatteryBadgeClass(type)}>
                      <Battery className="mr-1 h-3 w-3" />
                      {type}
                    </Badge>
                    <span className="text-sm font-medium">{data.quantity} units</span>
                  </div>
                  <span className="text-sm font-medium">${data.revenue.toLocaleString()}</span>
                </div>
                <Progress
                  value={(data.quantity / totalQuantity) * 100}
                  className={
                    type === "Alpha"
                      ? "text-blue-500"
                      : type === "Bravo"
                        ? "text-green-500"
                        : type === "Charlie"
                          ? "text-amber-500"
                          : "text-purple-500"
                  }
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{((data.quantity / totalQuantity) * 100).toFixed(1)}% of total units</span>
                  <span>{((data.revenue / totalCostOfGoods) * 100).toFixed(1)}% of total cost of goods</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Battery Sales Chart</CardTitle>
          <CardDescription>Visual representation of sales by battery type</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
              <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
              <Tooltip
                formatter={(value, name) => {
                  if (name === "costOfGoods") return [`$${Number(value).toLocaleString()}`, "Cost of Goods"]
                  return [value, "Quantity"]
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="quantity" name="Quantity" fill="#8884d8" />
              <Bar yAxisId="right" dataKey="costOfGoods" name="Cost of Goods" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
