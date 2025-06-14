"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getUnreconciledDistributions } from "@/lib/core-returns-data"
import { Building2, Battery, AlertTriangle, User } from "lucide-react"
import { RecordCoreReturnModal } from "./record-core-return-modal"

export function UnreconciledDistributionsTable() {
  const [unreconciledDistributions, setUnreconciledDistributions] = useState([])
  const [selectedDistribution, setSelectedDistribution] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    const distributions = getUnreconciledDistributions()
    setUnreconciledDistributions(distributions)
  }, [])

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

  const handleRecordReturn = (distribution) => {
    setSelectedDistribution(distribution)
    setModalOpen(true)
  }

  const handleCoreReturnAdded = () => {
    // Reload unreconciled distributions
    const distributions = getUnreconciledDistributions()
    setUnreconciledDistributions(distributions)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <CardTitle>Unreconciled Distributions</CardTitle>
        </div>
        <CardDescription>
          Batteries that have been distributed but don't have corresponding core returns
        </CardDescription>
      </CardHeader>
      <CardContent>
        {unreconciledDistributions.length > 0 ? (
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">Distribution ID</th>
                  <th className="p-3 text-left font-medium">Date</th>
                  <th className="p-3 text-left font-medium">Team Member</th>
                  <th className="p-3 text-left font-medium">Battery Type</th>
                  <th className="p-3 text-left font-medium">Quantity</th>
                  <th className="p-3 text-left font-medium">Location</th>
                  <th className="p-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {unreconciledDistributions.slice(0, 50).map((dist) => (
                  <tr key={dist.id} className="border-b">
                    <td className="p-3 font-medium">{dist.id}</td>
                    <td className="p-3">{dist.date}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{dist.teamMemberName}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">ID: {dist.teamMemberId}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={getBatteryBadgeClass(dist.batteryType)}>
                        <Battery className="mr-1 h-3 w-3" />
                        {dist.batteryType}
                      </Badge>
                    </td>
                    <td className="p-3">{dist.quantity}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={dist.location === "Broadway" ? "bg-blue-50" : "bg-green-50"}>
                        <Building2 className="mr-1 h-3 w-3" />
                        {dist.location}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Button variant="outline" size="sm" onClick={() => handleRecordReturn(dist)}>
                        Record Return
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {unreconciledDistributions.length > 50 && (
              <div className="p-3 text-center text-sm text-muted-foreground">
                Showing 50 of {unreconciledDistributions.length} unreconciled distributions.
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Battery className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No Unreconciled Distributions</h3>
            <p className="text-sm text-muted-foreground mt-1">
              All battery distributions have been properly reconciled.
            </p>
          </div>
        )}
      </CardContent>

      <RecordCoreReturnModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCoreReturnAdded={handleCoreReturnAdded}
        preselectedDistribution={selectedDistribution}
      />
    </Card>
  )
}
