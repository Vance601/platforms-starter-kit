"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Battery, Truck, User, Building2, CheckCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getMissingCoresReport, recordCoreReturn, getCoreReturnsData } from "@/lib/core-returns-data"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

export default function MissingCoresPage() {
  const searchParams = useSearchParams()
  const preselectedTeamMember = searchParams.get("teamMember") || ""
  const preselectedBatteryType = searchParams.get("batteryType") || ""
  const preselectedTruck = searchParams.get("truck") || ""
  const preselectedLocation = searchParams.get("location") || ""

  const [missingCoresReport, setMissingCoresReport] = useState<any>(null)
  const [selectedTeamMember, setSelectedTeamMember] = useState(preselectedTeamMember)
  const [selectedBatteryType, setSelectedBatteryType] = useState(preselectedBatteryType)
  const [selectedTruck, setSelectedTruck] = useState(preselectedTruck)
  const [selectedLocation, setSelectedLocation] = useState(preselectedLocation || "Broadway")
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [missingCores, setMissingCores] = useState<any>([])

  // Add verification code to ensure the page properly updates when cores are returned
  // Add this function near the top of the component:

  // Add a useEffect to refresh data when the component mounts
  useEffect(() => {
    // Get the latest missing cores data
    const missingCoresData = getMissingCoresByFilter(
      selectedTeamMember,
      selectedBatteryType,
      selectedTruck,
      selectedLocation,
    )

    setMissingCores(missingCoresData)

    // Update the report
    const report = getMissingCoresReport(missingCoresData)
    setMissingCoresReport(report)

    // Log verification
    console.log("Missing cores data refreshed:", missingCoresData.length, "records found")
  }, [selectedTeamMember, selectedBatteryType, selectedTruck, selectedLocation])

  // Load missing cores report
  useEffect(() => {
    // Generate a proper initial report with actual data
    const report = getMissingCoresReport(getCoreReturnsData())
    setMissingCoresReport(report)

    // If we have a preselected team member and battery type, set a default quantity
    if (preselectedTeamMember && preselectedBatteryType && report) {
      const teamMember = report.teamMember.find((tm: any) => tm.id === preselectedTeamMember)
      if (teamMember && teamMember.missingByType[preselectedBatteryType]) {
        setQuantity(teamMember.missingByType[preselectedBatteryType])
      }
    } else if (preselectedTeamMember && report) {
      const teamMember = report.teamMember.find((tm: any) => tm.id === preselectedTeamMember)
      if (teamMember) {
        setQuantity(teamMember.totalMissing)
      }
    } else if (preselectedBatteryType && report) {
      if (report.batteryType[preselectedBatteryType]) {
        setQuantity(report.batteryType[preselectedBatteryType])
      }
    }
  }, [preselectedTeamMember, preselectedBatteryType])

  // Get trucks list
  const trucks = [
    { id: "TRK-001", fleetNumber: "F-1001" },
    { id: "TRK-002", fleetNumber: "F-1002" },
    { id: "TRK-003", fleetNumber: "F-1003" },
    { id: "TRK-004", fleetNumber: "F-1004" },
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    if (!selectedTeamMember) {
      setError("Please select a team member")
      return
    }

    if (!selectedBatteryType) {
      setError("Please select a battery type")
      return
    }

    if (!selectedTruck) {
      setError("Please select a truck")
      return
    }

    if (quantity <= 0) {
      setError("Quantity must be greater than 0")
      return
    }

    setError("")
    setIsSubmitting(true)

    // Get team member details
    const teamMember = missingCoresReport.teamMember.find((tm: any) => tm.id === selectedTeamMember)

    // Get truck details
    const truck = trucks.find((t) => t.id === selectedTruck)

    // Create core return record
    const coreReturn = {
      saleId: `MANUAL-${Date.now()}`,
      teamMemberId: teamMember.id,
      teamMemberName: teamMember.name,
      truckId: truck!.id,
      truckNumber: truck!.fleetNumber,
      batteryType: selectedBatteryType as any,
      quantityDistributed: quantity,
      quantityReturned: quantity,
      dateDistributed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 7 days ago
      dateReturned: new Date().toISOString().split("T")[0],
      location: selectedLocation as any,
      notes: `Manually recorded missing core return. ${notes}`,
    }

    // Simulate API call
    setTimeout(() => {
      try {
        recordCoreReturn(coreReturn)
        setIsSubmitting(false)
        setSuccess(true)

        // Add this code to the handleCoreReturnAdded function:

        const handleCoreReturnAdded = () => {
          // Refresh the missing cores data
          const updatedMissingCores = getMissingCoresByFilter(
            selectedTeamMember,
            selectedBatteryType,
            selectedTruck,
            selectedLocation,
          )

          setMissingCores(updatedMissingCores)

          // Update the report
          const updatedReport = getMissingCoresReport(updatedMissingCores)
          setMissingCoresReport(updatedReport)

          // Log verification
          console.log("Core return recorded, missing cores updated:", updatedMissingCores.length, "records remaining")
        }

        handleCoreReturnAdded()

        // Reset form
        setTimeout(() => {
          setSelectedTeamMember("")
          setSelectedBatteryType("")
          setSelectedTruck("")
          setQuantity(1)
          setNotes("")
          setSuccess(false)
        }, 3000)
      } catch (err) {
        setIsSubmitting(false)
        setError("Failed to record core return. Please try again.")
      }
    }, 1000)
  }

  const getMissingCoresByFilter = (teamMember: string, batteryType: string, truck: string, location: string) => {
    // This is a placeholder function. Replace with your actual logic to fetch missing cores.
    // The logic should filter the missing cores based on the provided parameters.
    // For now, it returns an empty array.
    return getCoreReturnsData().filter((core) => {
      let include = true

      if (teamMember && core.teamMemberId !== teamMember) {
        include = false
      }

      if (batteryType && core.batteryType !== batteryType) {
        include = false
      }

      if (truck && core.truckId !== truck) {
        include = false
      }

      if (location && core.location !== location) {
        include = false
      }

      return include
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href="/core-returns">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Record Missing Cores Return</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enter Missing Cores Return</CardTitle>
          <CardDescription>Use this form to record the return of previously missing battery cores</CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>Core return has been recorded successfully.</AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Team Member Information</h3>
                  <div className="p-4 border rounded-md bg-muted/10">
                    <div className="space-y-2">
                      <Label htmlFor="teamMember">Team Member</Label>
                      <Select value={selectedTeamMember} onValueChange={setSelectedTeamMember}>
                        <SelectTrigger id="teamMember">
                          <SelectValue placeholder="Select team member" />
                        </SelectTrigger>
                        <SelectContent>
                          {missingCoresReport &&
                            missingCoresReport.teamMember &&
                            missingCoresReport.teamMember.map((member: any) => (
                              <SelectItem key={member.id} value={member.id}>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  {member.name} ({member.totalMissing} missing)
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>

                      {selectedTeamMember && missingCoresReport?.teamMember && (
                        <div className="mt-2 p-2 bg-muted/20 rounded-md">
                          <p className="text-sm">
                            <span className="text-muted-foreground">Missing cores: </span>
                            <span className="font-medium text-destructive">
                              {missingCoresReport.teamMember.find((tm: any) => tm.id === selectedTeamMember)
                                ?.totalMissing || 0}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Battery Information</h3>
                  <div className="p-4 border rounded-md bg-muted/10">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="batteryType">Battery Type</Label>
                        <Select value={selectedBatteryType} onValueChange={setSelectedBatteryType}>
                          <SelectTrigger id="batteryType">
                            <SelectValue placeholder="Select battery type" />
                          </SelectTrigger>
                          <SelectContent>
                            {missingCoresReport &&
                              missingCoresReport.batteryType &&
                              Object.entries(missingCoresReport.batteryType)
                                .filter(([_, count]) => (count as number) > 0)
                                .map(([type, count]) => (
                                  <SelectItem key={type} value={type}>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className={getBatteryBadgeClass(type)}>
                                        <Battery className="mr-1 h-3 w-3" />
                                        {type}
                                      </Badge>
                                      <span>({count} missing)</span>
                                    </div>
                                  </SelectItem>
                                ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity Returned</Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => setQuantity(Number.parseInt(e.target.value) || 0)}
                        />
                        {selectedTeamMember && selectedBatteryType && missingCoresReport?.teamMember && (
                          <p className="text-xs text-muted-foreground">
                            Recommended:{" "}
                            {missingCoresReport.teamMember.find((tm: any) => tm.id === selectedTeamMember)
                              ?.missingByType[selectedBatteryType] || 0}{" "}
                            cores
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Return Information</h3>
                  <div className="p-4 border rounded-md bg-muted/10">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="truck">Truck</Label>
                        <Select value={selectedTruck} onValueChange={setSelectedTruck}>
                          <SelectTrigger id="truck">
                            <SelectValue placeholder="Select truck" />
                          </SelectTrigger>
                          <SelectContent>
                            {trucks.map((truck) => (
                              <SelectItem key={truck.id} value={truck.id}>
                                <div className="flex items-center gap-2">
                                  <Truck className="h-4 w-4 text-muted-foreground" />
                                  {truck.fleetNumber}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="location">Return Location</Label>
                        <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                          <SelectTrigger id="location">
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Broadway">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-blue-500" />
                                Broadway
                              </div>
                            </SelectItem>
                            <SelectItem value="Camelback">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-green-500" />
                                Camelback
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Additional Information</h3>
                  <div className="p-4 border rounded-md bg-muted/10">
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        placeholder="Add any notes about the returned cores"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2">
                <Link href="/core-returns">
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Recording..." : "Record Core Return"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
