"use client"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Battery } from "lucide-react"
import { useInventoryStore } from "@/stores/inventory-store"

interface BatteryInventoryData {
  type: string
  current: number
  threshold: number
  max: number
  location: string
}

export function BatteryInventoryChart() {
  const { inventory, trucks } = useInventoryStore()
  // Sample data - in a real app, this would come from your database
  const batteryInventory: BatteryInventoryData[] = [
    { type: "Alpha", current: 61, threshold: 40, max: 100, location: "Broadway" },
    { type: "Bravo", current: 92, threshold: 80, max: 150, location: "Broadway" },
    { type: "Charlie", current: 32, threshold: 35, max: 80, location: "Broadway" },
    { type: "AMG", current: 8, threshold: 10, max: 30, location: "Broadway" },
    { type: "Alpha", current: 19, threshold: 20, max: 50, location: "Camelback" },
    { type: "Bravo", current: 47, threshold: 40, max: 100, location: "Camelback" },
    { type: "Charlie", current: 24, threshold: 30, max: 60, location: "Camelback" },
    { type: "AMG", current: 11, threshold: 15, max: 25, location: "Camelback" },
  ]

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
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                formatter={(value, name) => {
                  return [`${value} units`, name === "threshold" ? "Threshold" : `${name} Location`]
                }}
              />
              <Bar dataKey="Broadway" name="Broadway" stackId="a">
                {chartData.map((entry, index) => {
                  const batteryData = batteryInventory.find((b) => b.type === entry.name && b.location === "Broadway")
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
                  const batteryData = batteryInventory.find((b) => b.type === entry.name && b.location === "Camelback")
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
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          {batteryInventory.map((battery, index) => {
            const percentOfMax = (battery.current / battery.max) * 100
            const percentOfThreshold = (battery.current / battery.threshold) * 100
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
                        ? `${Math.round((battery.current / battery.threshold) * 100)}% of min`
                        : "OK"}
                    </Badge>
                  </div>
                </div>
                <Progress value={percentOfMax} className="h-2" style={{ color }} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Min: {battery.threshold}</span>
                  <span>Max: {battery.max}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
