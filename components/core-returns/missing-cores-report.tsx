"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Battery, Truck, Building2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

interface MissingCoresReportProps {
  report: {
    teamMember: {
      id: string
      name: string
      totalMissing: number
      missingByType: Record<string, number>
      returns: any[]
    }[]
    truck: {
      id: string
      number: string
      totalMissing: number
      missingByType: Record<string, number>
      returns: any[]
    }[]
    batteryType: Record<string, number>
    location: Record<string, number>
    total: number
  }
  detailed?: boolean
}

export function MissingCoresReport({ report, detailed = false }: MissingCoresReportProps) {
  const router = useRouter()

  // Add useEffect to verify data updates
  useEffect(() => {
    // Log verification that the report is updating
    console.log("Missing cores report updated:", report.total, "total missing cores")

    // Verify team member data
    console.log("Team members with missing cores:", report.teamMember.length)

    // Verify battery type data
    const batteryTypesWithMissing = Object.entries(report.batteryType)
      .filter(([_, count]) => count > 0)
      .map(([type]) => type)
    console.log("Battery types with missing cores:", batteryTypesWithMissing)
  }, [report])

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

  const handleMissingCoreClick = (teamMemberId: string, batteryType?: string, truckId?: string, location?: string) => {
    // Navigate to the missing cores page with query parameters
    const params = new URLSearchParams()
    if (teamMemberId) params.append("teamMember", teamMemberId)
    if (batteryType) params.append("batteryType", batteryType)
    if (truckId) params.append("truck", truckId)
    if (location) params.append("location", location)

    router.push(`/core-returns/missing?${params.toString()}`)
  }

  if (report.total === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No missing cores to report.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!detailed ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Missing Cores by Team Member</h3>
            <div className="space-y-3">
              {report.teamMember.slice(0, 3).map((member) => (
                <div key={member.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={`/placeholder.svg?key=b9dbp&height=24&width=24`} alt={member.name} />
                      <AvatarFallback>
                        {member.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{member.name}</span>
                  </div>
                  <Badge
                    variant="destructive"
                    className="cursor-pointer hover:bg-destructive/90"
                    onClick={() => handleMissingCoreClick(member.id)}
                  >
                    {member.totalMissing} cores
                  </Badge>
                </div>
              ))}
              {report.teamMember.length > 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  And {report.teamMember.length - 3} more team members with missing cores
                </p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Missing Cores by Battery Type</h3>
            <div className="space-y-3">
              {Object.entries(report.batteryType)
                .filter(([_, count]) => count > 0)
                .sort(([_, a], [__, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <Badge variant="outline" className={getBatteryBadgeClass(type)}>
                      <Battery className="mr-1 h-3 w-3" />
                      {type}
                    </Badge>
                    <span
                      className="text-sm font-medium text-destructive cursor-pointer hover:underline"
                      onClick={() => handleMissingCoreClick("", type)}
                    >
                      {count} cores
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : (
        <Tabs defaultValue="team-members">
          <TabsList className="w-full">
            <TabsTrigger value="team-members">By Team Member</TabsTrigger>
            <TabsTrigger value="trucks">By Truck</TabsTrigger>
            <TabsTrigger value="battery-types">By Battery Type</TabsTrigger>
            <TabsTrigger value="locations">By Location</TabsTrigger>
          </TabsList>

          <TabsContent value="team-members" className="mt-6">
            <div className="space-y-6">
              {report.teamMember.map((member) => (
                <div key={member.id} className="space-y-2 border-b pb-4 last:border-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={`/placeholder-32px.png?height=32&width=32`} alt={member.name} />
                        <AvatarFallback>
                          {member.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-medium">{member.name}</h4>
                        <p className="text-sm text-muted-foreground">ID: {member.id}</p>
                      </div>
                    </div>
                    <Badge
                      variant="destructive"
                      className="text-base cursor-pointer hover:bg-destructive/90"
                      onClick={() => handleMissingCoreClick(member.id)}
                    >
                      {member.totalMissing} cores missing
                    </Badge>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {Object.entries(member.missingByType)
                      .filter(([_, count]) => count > 0)
                      .map(([type, count]) => (
                        <div
                          key={type}
                          className="flex items-center justify-between bg-muted/30 p-2 rounded-md cursor-pointer hover:bg-muted"
                          onClick={() => handleMissingCoreClick(member.id, type)}
                        >
                          <Badge variant="outline" className={getBatteryBadgeClass(type)}>
                            <Battery className="mr-1 h-3 w-3" />
                            {type}
                          </Badge>
                          <span className="text-sm font-medium text-destructive">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="trucks" className="mt-6">
            <div className="space-y-6">
              {report.truck.map((truck) => (
                <div key={truck.id} className="space-y-2 border-b pb-4 last:border-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <h4 className="font-medium">{truck.number}</h4>
                        <p className="text-sm text-muted-foreground">ID: {truck.id}</p>
                      </div>
                    </div>
                    <Badge
                      variant="destructive"
                      className="text-base cursor-pointer hover:bg-destructive/90"
                      onClick={() => handleMissingCoreClick("", "", truck.id)}
                    >
                      {truck.totalMissing} cores missing
                    </Badge>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {Object.entries(truck.missingByType)
                      .filter(([_, count]) => count > 0)
                      .map(([type, count]) => (
                        <div
                          key={type}
                          className="flex items-center justify-between bg-muted/30 p-2 rounded-md cursor-pointer hover:bg-muted"
                          onClick={() => handleMissingCoreClick("", type, truck.id)}
                        >
                          <Badge variant="outline" className={getBatteryBadgeClass(type)}>
                            <Battery className="mr-1 h-3 w-3" />
                            {type}
                          </Badge>
                          <span className="text-sm font-medium text-destructive">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="battery-types" className="mt-6">
            <div className="space-y-4">
              {Object.entries(report.batteryType)
                .filter(([_, count]) => count > 0)
                .sort(([_, a], [__, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={getBatteryBadgeClass(type)}>
                        <Battery className="mr-1 h-3 w-3" />
                        {type}
                      </Badge>
                      <span
                        className="font-medium text-destructive cursor-pointer hover:underline"
                        onClick={() => handleMissingCoreClick("", type)}
                      >
                        {count} cores missing
                      </span>
                    </div>
                    <Progress
                      value={(count / report.total) * 100}
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
                    <p className="text-xs text-muted-foreground text-right">
                      {((count / report.total) * 100).toFixed(1)}% of total missing cores
                    </p>
                  </div>
                ))}
            </div>
          </TabsContent>

          <TabsContent value="locations" className="mt-6">
            <div className="space-y-4">
              {Object.entries(report.location)
                .filter(([_, count]) => count > 0)
                .sort(([_, a], [__, b]) => b - a)
                .map(([location, count]) => (
                  <div key={location} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={location === "Broadway" ? "bg-blue-50" : "bg-green-50"}>
                        <Building2 className="mr-1 h-3 w-3" />
                        {location}
                      </Badge>
                      <span
                        className="font-medium text-destructive cursor-pointer hover:underline"
                        onClick={() => handleMissingCoreClick("", "", "", location)}
                      >
                        {count} cores missing
                      </span>
                    </div>
                    <Progress
                      value={(count / report.total) * 100}
                      className={location === "Broadway" ? "text-blue-500" : "text-green-500"}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {((count / report.total) * 100).toFixed(1)}% of total missing cores
                    </p>
                  </div>
                ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
      {detailed && report.total > 0 && (
        <div className="mt-6 flex justify-center">
          <Link href="/core-returns/missing">
            <Button>Record Missing Cores Return</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
