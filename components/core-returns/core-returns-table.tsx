"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { CoreReturn } from "@/lib/core-returns-data"
import { Building2, Truck, Battery, User } from "lucide-react"

interface CoreReturnsTableProps {
  returns: CoreReturn[]
}

export function CoreReturnsTable({ returns }: CoreReturnsTableProps) {
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "Fully Returned":
        return "default"
      case "Partially Returned":
        return "warning"
      case "Not Returned":
        return "destructive"
      default:
        return "outline"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Core Returns</CardTitle>
        <CardDescription>Complete list of all core returns during the selected period</CardDescription>
      </CardHeader>
      <CardContent>
        {returns.length > 0 ? (
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">Return ID</th>
                  <th className="p-3 text-left font-medium">Date</th>
                  <th className="p-3 text-left font-medium">Team Member</th>
                  <th className="p-3 text-left font-medium">Truck</th>
                  <th className="p-3 text-left font-medium">Battery Type</th>
                  <th className="p-3 text-left font-medium">Distributed</th>
                  <th className="p-3 text-left font-medium">Returned</th>
                  <th className="p-3 text-left font-medium">Missing</th>
                  <th className="p-3 text-left font-medium">Location</th>
                  <th className="p-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((ret) => (
                  <tr key={ret.id} className="border-b">
                    <td className="p-3 font-medium">{ret.id}</td>
                    <td className="p-3">{ret.dateReturned}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{ret.teamMemberName}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">ID: {ret.teamMemberId}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <Truck className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{ret.truckNumber}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">ID: {ret.truckId}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={getBatteryBadgeClass(ret.batteryType)}>
                        <Battery className="mr-1 h-3 w-3" />
                        {ret.batteryType}
                      </Badge>
                    </td>
                    <td className="p-3">{ret.quantityDistributed}</td>
                    <td className="p-3">{ret.quantityReturned}</td>
                    <td className="p-3">
                      {ret.quantityDistributed - ret.quantityReturned > 0 ? (
                        <span className="text-destructive font-medium">
                          {ret.quantityDistributed - ret.quantityReturned}
                        </span>
                      ) : (
                        <span>0</span>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={ret.location === "Broadway" ? "bg-blue-50" : "bg-green-50"}>
                        <Building2 className="mr-1 h-3 w-3" />
                        {ret.location}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={getStatusBadgeVariant(ret.status)}>{ret.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Battery className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No Core Returns Found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              There are no core returns recorded during the selected period.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
