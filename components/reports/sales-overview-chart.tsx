"use client"

import { useState } from "react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { BarChart3Icon, LineChartIcon, Download, Calendar } from "lucide-react"

// Simple, high-contrast color palette
const COLORS = {
  Alpha: "#2563eb", // Blue
  Bravo: "#16a34a", // Green
  Charlie: "#ca8a04", // Yellow
  AMG: "#dc2626", // Red
}

// Simple tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-2 border border-gray-200 shadow-sm rounded-md text-xs">
        <p className="font-medium text-gray-900">{label}</p>
        <div className="mt-1 space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={`tooltip-${index}`} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="font-medium text-gray-700">{entry.name}</span>
              </div>
              <span className="font-medium text-gray-900">{entry.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

// Time period options
const TIME_PERIODS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
]

interface SalesOverviewChartProps {
  data: any[]
}

export function SalesOverviewChart({ data }: SalesOverviewChartProps) {
  const [chartType, setChartType] = useState("bar")
  const [timePeriod, setTimePeriod] = useState("monthly")

  // Function to export chart data as CSV
  const exportData = () => {
    const headers = ["Month", ...Object.keys(COLORS)]
    const csvContent = [
      headers.join(","),
      ...data.map((entry) => {
        return [entry.month, ...Object.keys(COLORS).map((location) => entry[location] || 0)].join(",")
      }),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `sales_overview_${timePeriod}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Card className="w-full relative z-10">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Sales Overview</CardTitle>
            <CardDescription className="text-xs text-gray-500">Monthly sales by battery type</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timePeriod} onValueChange={setTimePeriod}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <Calendar className="mr-2 h-3 w-3" />
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                {TIME_PERIODS.map((period) => (
                  <SelectItem key={period.value} value={period.value} className="text-xs">
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportData} className="h-8 text-xs">
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        <Tabs value={chartType} onValueChange={setChartType} className="w-full">
          <TabsList className="mb-2 w-full sm:w-auto h-8">
            <TabsTrigger value="bar" className="flex-1 sm:flex-initial text-xs">
              <BarChart3Icon className="mr-1 h-3 w-3" />
              Bar
            </TabsTrigger>
            <TabsTrigger value="line" className="flex-1 sm:flex-initial text-xs">
              <LineChartIcon className="mr-1 h-3 w-3" />
              Line
            </TabsTrigger>
          </TabsList>

          <div className="h-[200px] mt-2">
            <TabsContent value="bar" className="h-full mt-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#374151", fontSize: 10 }}
                    axisLine={{ stroke: "#e5e7eb" }}
                    tickLine={{ stroke: "#e5e7eb" }}
                    dy={5}
                  />
                  <YAxis
                    tick={{ fill: "#374151", fontSize: 10 }}
                    axisLine={{ stroke: "#e5e7eb" }}
                    tickLine={{ stroke: "#e5e7eb" }}
                    tickFormatter={(value) => value.toLocaleString()}
                    width={40}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={20}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingTop: 0, fontSize: 10, bottom: 0 }}
                  />
                  {Object.entries(COLORS).map(([key, color]) => (
                    <Bar key={`bar-${key}`} dataKey={key} name={key} fill={color} barSize={15} radius={[2, 2, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="line" className="h-full mt-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#374151", fontSize: 10 }}
                    axisLine={{ stroke: "#e5e7eb" }}
                    tickLine={{ stroke: "#e5e7eb" }}
                    dy={5}
                  />
                  <YAxis
                    tick={{ fill: "#374151", fontSize: 10 }}
                    axisLine={{ stroke: "#e5e7eb" }}
                    tickLine={{ stroke: "#e5e7eb" }}
                    tickFormatter={(value) => value.toLocaleString()}
                    width={40}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={20}
                    iconType="line"
                    iconSize={8}
                    wrapperStyle={{ paddingTop: 0, fontSize: 10 }}
                  />
                  {Object.entries(COLORS).map(([key, color]) => (
                    <Line
                      key={`line-${key}`}
                      type="monotone"
                      dataKey={key}
                      name={key}
                      stroke={color}
                      strokeWidth={2}
                      dot={{ r: 3, fill: color, strokeWidth: 0 }}
                      activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  )
}
