"use client"

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const data = [
  {
    date: "Jan",
    usage: 12,
    restock: 0,
  },
  {
    date: "Feb",
    usage: 18,
    restock: 50,
  },
  {
    date: "Mar",
    usage: 24,
    restock: 0,
  },
  {
    date: "Apr",
    usage: 32,
    restock: 0,
  },
  {
    date: "May",
    usage: 28,
    restock: 100,
  },
  {
    date: "Jun",
    usage: 42,
    restock: 0,
  },
  {
    date: "Jul",
    usage: 38,
    restock: 0,
  },
  {
    date: "Aug",
    usage: 25,
    restock: 75,
  },
  {
    date: "Sep",
    usage: 30,
    restock: 0,
  },
  {
    date: "Oct",
    usage: 35,
    restock: 0,
  },
  {
    date: "Nov",
    usage: 40,
    restock: 50,
  },
  {
    date: "Dec",
    usage: 45,
    restock: 0,
  },
]

export function InventoryUsageChart() {
  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 10,
            left: 10,
            bottom: 0,
          }}
        >
          <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip />
          <Line type="monotone" dataKey="usage" stroke="#f97316" strokeWidth={2} activeDot={{ r: 6 }} name="Usage" />
          <Line
            type="monotone"
            dataKey="restock"
            stroke="#16a34a"
            strokeWidth={2}
            activeDot={{ r: 6 }}
            name="Restock"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
