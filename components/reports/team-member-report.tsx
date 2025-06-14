"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type SaleRecord, getSalesByTeamMember } from "@/lib/sales-data"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface TeamMemberReportProps {
  sales: SaleRecord[]
}

export function TeamMemberReport({ sales }: TeamMemberReportProps) {
  const salesByTeamMember = getSalesByTeamMember(sales)
  const totalCostOfGoods = salesByTeamMember.reduce((sum, member) => sum + member.revenue, 0)

  // Prepare data for chart
  const chartData = salesByTeamMember.map((member) => ({
    name: member.name.split(" ")[0], // Just use first name for chart
    quantity: member.quantity,
    costOfGoods: member.revenue,
  }))

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Sales by Team Member</CardTitle>
          <CardDescription>Performance breakdown by team member</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {salesByTeamMember.map((member) => (
              <div key={member.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={`/placeholder.svg?height=24&width=24`} alt={member.name} />
                      <AvatarFallback>
                        {member.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{member.name}</span>
                  </div>
                  <span className="text-sm font-medium">${member.revenue.toLocaleString()}</span>
                </div>
                <Progress value={(member.revenue / totalCostOfGoods) * 100} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{member.quantity} units sold</span>
                  <span>{((member.revenue / totalCostOfGoods) * 100).toFixed(1)}% of total cost of goods</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Performance Chart</CardTitle>
          <CardDescription>Visual representation of sales by team member</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={80} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === "costOfGoods") return [`$${Number(value).toLocaleString()}`, "Cost of Goods"]
                  return [value, "Quantity"]
                }}
              />
              <Legend />
              <Bar dataKey="quantity" name="Quantity" fill="#8884d8" />
              <Bar dataKey="costOfGoods" name="Cost of Goods" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
