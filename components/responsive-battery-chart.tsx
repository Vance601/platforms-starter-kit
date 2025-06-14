"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
  ReferenceLine,
} from "recharts"
import { Battery, ArrowUpCircle, ArrowDownCircle } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useInventoryStore } from "@/lib/inventory-store"

interface BatteryInventoryData {
  type: string
  current: number
  threshold: number
  max: number
  location: string
}

export function ResponsiveBatteryChart() {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const { inventory } = useInventoryStore()

  // Define thresholds and max values for each battery type
  const thresholds = {
    Alpha: { threshold: 40, max: 100 },
    Bravo: { threshold: 80, max: 150 },
    Charlie: { threshold: 35, max: 80 },
    AMG: { threshold: 10, max: 30 },
  }

  // Transform inventory data to the format needed for the chart
  const batteryInventory: BatteryInventoryData[] = inventory.flatMap((item) => {
    const typeConfig = thresholds[item.type as keyof typeof thresholds] || { threshold: 20, max: 50 }
    const parLevel = item.parLevel || typeConfig.threshold

    // Create an entry for each location
    return [
      {
        type: item.type,
        current: item.locations.broadway || 0,
        threshold: parLevel, // Use par level if available
        max: typeConfig.max,
        location: "Broadway",
      },
      {
        type: item.type,
        current: item.locations.camelback || 0,
        threshold: parLevel, // Use par level if available
        max: typeConfig.max,
        location: "Camelback",
      },
    ]
  })

  // Prepare data for the chart
  const chartData = [
    {
      name: "Alpha",
      Broadway: batteryInventory.find((b) => b.type === "Alpha" && b.location === "Broadway")?.current || 0,
      Camelback: batteryInventory.find((b) => b.type === "Alpha" && b.location === "Camelback")?.current || 0,
      threshold: batteryInventory.find((b) => b.type === "Alpha" && b.location === "Broadway")?.threshold || 0,
    },
    {
      name: "Bravo",
      Broadway: batteryInventory.find((b) => b.type === "Bravo" && b.location === "Broadway")?.current || 0,
      Camelback: batteryInventory.find((b) => b.type === "Bravo" && b.location === "Camelback")?.current || 0,
      threshold: batteryInventory.find((b) => b.type === "Bravo" && b.location === "Broadway")?.threshold || 0,
    },
    {
      name: "Charlie",
      Broadway: batteryInventory.find((b) => b.type === "Charlie" && b.location === "Broadway")?.current || 0,
      Camelback: batteryInventory.find((b) => b.type === "Charlie" && b.location === "Camelback")?.current || 0,
      threshold: batteryInventory.find((b) => b.type === "Charlie" && b.location === "Broadway")?.threshold || 0,
    },
    {
      name: "AMG",
      Broadway: batteryInventory.find((b) => b.type === "AMG" && b.location === "Broadway")?.current || 0,
      Camelback: batteryInventory.find((b) => b.type === "AMG" && b.location === "Camelback")?.current || 0,
      threshold: batteryInventory.find((b) => b.type === "AMG" && b.location === "Broadway")?.threshold || 0,
    },
  ]

  // Prepare data for pie chart (mobile view)
  const pieData = [
    { name: "Alpha", value: chartData[0].Broadway + chartData[0].Camelback, color: "#0088FE" },
    { name: "Bravo", value: chartData[1].Broadway + chartData[1].Camelback, color: "#00C49F" },
    { name: "Charlie", value: chartData[2].Broadway + chartData[2].Camelback, color: "#FFBB28" },
    { name: "AMG", value: chartData[3].Broadway + chartData[3].Camelback, color: "#FF8042" },
  ]

  // Function to determine color based on inventory level
  const getInventoryColor = (current: number, threshold: number, max: number) => {
    const ratio = current / threshold
    if (ratio <= 0.5) return "#ef4444" // Red - critically low
    if (ratio <= 0.75) return "#f97316" // Orange - very low
    if (ratio <= 1) return "#eab308" // Yellow - low
    if (ratio <= 1.5) return "#84cc16" // Light green - adequate
    return "#22c55e" // Green - good
  }

  // Get badge class based on battery type
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
    <div className="space-y-4 pb-16 md:pb-0">
      {/* Desktop/Tablet View */}
      {isDesktop ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-lg">Battery Inventory Levels</CardTitle>
              <CardDescription>Current stock levels by battery type and location</CardDescription>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip
                      formatter={(value, name) => {
                        return [`${value} units`, name === "threshold" ? "Par Level" : `${name} Location`]
                      }}
                    />
                    <Bar dataKey="Broadway" name="Broadway" stackId="a">
                      {chartData.map((entry, index) => {
                        const batteryData = batteryInventory.find(
                          (b) => b.type === entry.name && b.location === "Broadway",
                        )
                        return (
                          <Cell
                            key={`cell-broadway-${index}`}
                            fill={
                              batteryData
                                ? getInventoryColor(batteryData.current, batteryData.threshold, batteryData.max)
                                : "#cccccc"
                            }
                          />
                        )
                      })}
                    </Bar>
                    <Bar dataKey="Camelback" name="Camelback" stackId="b">
                      {chartData.map((entry, index) => {
                        const batteryData = batteryInventory.find(
                          (b) => b.type === entry.name && b.location === "Camelback",
                        )
                        return (
                          <Cell
                            key={`cell-camelback-${index}`}
                            fill={
                              batteryData
                                ? getInventoryColor(batteryData.current, batteryData.threshold, batteryData.max)
                                : "#cccccc"
                            }
                          />
                        )
                      })}
                    </Bar>
                    {/* Add reference lines for par levels */}
                    {chartData.map((entry, index) => (
                      <ReferenceLine
                        key={`ref-line-${index}`}
                        x={entry.name}
                        y={entry.threshold}
                        stroke="#ff0000"
                        strokeDasharray="3 3"
                        label={{ value: "Par", position: "insideTopRight", fill: "#ff0000", fontSize: 10 }}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-lg">Inventory Status</CardTitle>
              <CardDescription>Current inventory levels relative to par levels</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-2">
              <div className="space-y-6">
                {batteryInventory.map((battery, index) => {
                  const percentOfMax = (battery.current / battery.max) * 100
                  const color = getInventoryColor(battery.current, battery.threshold, battery.max)

                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getBatteryBadgeClass(battery.type)}>
                            <Battery className="mr-1 h-3 w-3" />
                            {battery.type}
                          </Badge>
                          <span className="text-sm font-medium">{battery.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{battery.current} units</span>
                          <Badge
                            variant={battery.current < battery.threshold ? "destructive" : "default"}
                            className={battery.current < battery.threshold ? "" : "bg-green-500"}
                          >
                            {battery.current < battery.threshold
                              ? `${Math.round((battery.current / battery.threshold) * 100)}% of par`
                              : "OK"}
                          </Badge>
                        </div>
                      </div>
                      <Progress value={percentOfMax} className="h-2" style={{ color }} />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Par: {battery.threshold}</span>
                        <span>Max: {battery.max}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Mobile View */
        <div className="space-y-4">
          <Card>
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-lg">Battery Distribution</CardTitle>
              <CardDescription>Inventory by battery type</CardDescription>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} units`, ""]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-lg">Critical Inventory</CardTitle>
              <CardDescription>Batteries below par level</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-2">
              <div className="space-y-4">
                {batteryInventory
                  .filter((battery) => battery.current < battery.threshold)
                  .map((battery, index) => {
                    const percentOfThreshold = (battery.current / battery.threshold) * 100

                    return (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getBatteryBadgeClass(battery.type)}>
                            <Battery className="mr-1 h-3 w-3" />
                            {battery.type}
                          </Badge>
                          <div>
                            <p className="font-medium">{battery.location}</p>
                            <p className="text-sm text-muted-foreground">
                              {battery.current}/{battery.threshold} units
                            </p>
                          </div>
                        </div>
                        <ArrowDownCircle className="h-6 w-6 text-destructive" />
                      </div>
                    )
                  })}

                {batteryInventory
                  .filter(
                    (battery) => battery.current >= battery.threshold && battery.current <= battery.threshold * 1.2,
                  )
                  .map((battery, index) => {
                    return (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getBatteryBadgeClass(battery.type)}>
                            <Battery className="mr-1 h-3 w-3" />
                            {battery.type}
                          </Badge>
                          <div>
                            <p className="font-medium">{battery.location}</p>
                            <p className="text-sm text-muted-foreground">
                              {battery.current}/{battery.threshold} units
                            </p>
                          </div>
                        </div>
                        <ArrowUpCircle className="h-6 w-6 text-yellow-500" />
                      </div>
                    )
                  })}

                {batteryInventory.filter(
                  (battery) =>
                    battery.current < battery.threshold ||
                    (battery.current >= battery.threshold && battery.current <= battery.threshold * 1.2),
                ).length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">No critical inventory at this time</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
