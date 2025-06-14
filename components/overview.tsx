"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { useInventoryStore } from "@/lib/inventory-store"

export function Overview() {
  const { inventory } = useInventoryStore()

  // Transform inventory data for the chart with null/undefined checks
  const data = Array.isArray(inventory)
    ? inventory.map((item) => ({
        name: item.type || "Unknown",
        total: item.totalCount || 0,
        broadway: item.locations?.broadway || 0,
        camelback: item.locations?.camelback || 0,
      }))
    : []

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
        <Tooltip
          formatter={(value, name) => {
            return [`${value} units`, name === "total" ? "Total" : `${name} Location`]
          }}
        />
        <Bar dataKey="total" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
      </BarChart>
    </ResponsiveContainer>
  )
}
