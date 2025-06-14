"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertCircle, CheckCircle, Loader2, Building2, Truck, Battery, User } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { getSalesData, recordCoreReturn } from "@/lib/core-returns-data"

interface RecordCoreReturnModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCoreReturnAdded: () => void
  preselectedDistribution?: any
}

export function RecordCoreReturnModal({
  open,
  onOpenChange,
  onCoreReturnAdded,
  preselectedDistribution = null,
}: RecordCoreReturnModalProps) {
  const [sales, setSales] = useState([])
  const [selectedSale, setSelectedSale] = useState(null)
  const [trucks, setTrucks] = useState([
    { id: "TRK-001", fleetNumber: "F-1001" },
    { id: "TRK-002", fleetNumber: "F-1002" },
    { id: "TRK-003", fleetNumber: "F-1003" },
    { id: "TRK-004", fleetNumber: "F-1004" },
  ])
  const [selectedTruck, setSelectedTruck] = useState("")
  const [quantityReturned, setQuantityReturned] = useState(0)
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Load sales data
  useEffect(() => {
    const salesData = getSalesData()
    setSales(salesData)
  }, [])

  // Handle preselected distribution
  useEffect(() => {
    if (preselectedDistribution) {
      setSelectedSale(preselectedDistribution)
      setQuantityReturned(preselectedDistribution.quantity) // Default to full return
    }
  }, [preselectedDistribution])

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) {
      if (!preselectedDistribution) {
        setSelectedSale(null)
      }
      setSelectedTruck("")
      setQuantityReturned(preselectedDistribution ? preselectedDistribution.quantity : 0)
      setNotes("")
      setError(null)
      setSuccess(false)
    }
  }, [open, preselectedDistribution])

  const handleSubmit = () => {
    // Validate form
    if (!selectedSale) {
      setError("Please select a distribution")
      return
    }

    if (!selectedTruck) {
      setError("Please select a truck")
      return
    }

    if (quantityReturned < 0 || quantityReturned > selectedSale.quantity) {
      setError(`Quantity returned must be between 0 and ${selectedSale.quantity}`)
      return
    }

    setError(null)
    setIsSubmitting(true)

    // Get truck details
    const truck = trucks.find((t) => t.id === selectedTruck)

    // Create core return record
    const coreReturn = {
      saleId: selectedSale.id,
      teamMemberId: selectedSale.teamMemberId,
      teamMemberName: selectedSale.teamMemberName,
      truckId: truck.id,
      truckNumber: truck.fleetNumber,
      batteryType: selectedSale.batteryType,
      quantityDistributed: selectedSale.quantity,
      quantityReturned: Number.parseInt(quantityReturned),
      dateDistributed: selectedSale.date,
      dateReturned: new Date().toISOString().split("T")[0],
      location: selectedSale.location,
      notes: notes,
    }

    // Simulate API call
    setTimeout(() => {
      try {
        // Record the core return - this will now properly update existing returns
        recordCoreReturn(coreReturn)
        setIsSubmitting(false)
        setSuccess(true)

        // Notify parent component
        onCoreReturnAdded()

        // Close modal after showing success message
        setTimeout(() => {
          setSuccess(false)
          onOpenChange(false)
        }, 1500)
      } catch (err) {
        setIsSubmitting(false)
        setError("Failed to record core return. Please try again.")
      }
    }, 1000)
  }

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Record Core Return</DialogTitle>
          <DialogDescription>Record returned battery cores from a team member</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6">
            <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>Core return has been recorded successfully.</AlertDescription>
            </Alert>
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="distribution">Battery Distribution</Label>
                {preselectedDistribution ? (
                  <div className="flex items-center gap-2 p-2 border rounded-md">
                    <div className="flex-1">
                      <p className="font-medium">{preselectedDistribution.id}</p>
                      <p className="text-sm text-muted-foreground">
                        {preselectedDistribution.teamMemberName} • {preselectedDistribution.date}
                      </p>
                    </div>
                    <Badge variant="outline" className={getBatteryBadgeClass(preselectedDistribution.batteryType)}>
                      <Battery className="mr-1 h-3 w-3" />
                      {preselectedDistribution.batteryType}
                    </Badge>
                    <Badge>{preselectedDistribution.quantity} units</Badge>
                  </div>
                ) : (
                  <Select
                    value={selectedSale?.id || ""}
                    onValueChange={(value) => {
                      const sale = sales.find((s) => s.id === value)
                      setSelectedSale(sale)
                      setQuantityReturned(sale.quantity) // Default to full return
                    }}
                  >
                    <SelectTrigger id="distribution">
                      <SelectValue placeholder="Select a battery distribution" />
                    </SelectTrigger>
                    <SelectContent>
                      {sales.slice(0, 50).map((sale) => (
                        <SelectItem key={sale.id} value={sale.id}>
                          <div className="flex items-center gap-2">
                            <span>{sale.id}</span>
                            <span className="text-muted-foreground">•</span>
                            <Badge variant="outline" className={getBatteryBadgeClass(sale.batteryType)}>
                              {sale.batteryType}
                            </Badge>
                            <span className="text-muted-foreground">•</span>
                            <span>{sale.quantity} units</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {selectedSale && (
                <div className="p-3 border rounded-md bg-muted/20">
                  <h3 className="font-medium mb-2">Distribution Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Distribution ID:</span>
                      <span className="ml-2 font-medium">{selectedSale.id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date:</span>
                      <span className="ml-2">{selectedSale.date}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Battery Type:</span>
                      <span className="ml-2">
                        <Badge variant="outline" className={getBatteryBadgeClass(selectedSale.batteryType)}>
                          <Battery className="mr-1 h-3 w-3" />
                          {selectedSale.batteryType}
                        </Badge>
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Quantity:</span>
                      <span className="ml-2">{selectedSale.quantity} units</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="teamMember" className="text-base font-medium">
                  Team Member Information
                </Label>
                {preselectedDistribution ? (
                  <div className="flex items-center gap-2 p-2 border rounded-md">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{preselectedDistribution.teamMemberName}</span>
                    <Badge variant="outline">ID: {preselectedDistribution.teamMemberId}</Badge>
                  </div>
                ) : selectedSale ? (
                  <div className="flex items-center gap-2 p-2 border rounded-md">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{selectedSale.teamMemberName}</span>
                    <Badge variant="outline">ID: {selectedSale.teamMemberId}</Badge>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-2 border rounded-md">
                    Select a distribution to see team member information
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="truck" className="text-base font-medium">
                  Truck Information
                </Label>
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
                <Label htmlFor="location" className="text-base font-medium">
                  Return Location
                </Label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Badge
                      variant="outline"
                      className={selectedSale?.location === "Broadway" ? "bg-blue-50" : "bg-green-50"}
                    >
                      <Building2 className="mr-1 h-3 w-3" />
                      {selectedSale ? selectedSale.location : "Select a distribution"}
                    </Badge>
                    <span className="ml-2 text-sm text-muted-foreground">(Distribution Location)</span>
                  </div>

                  <div className="flex-1">
                    <Select defaultValue={selectedSale?.location || "Broadway"}>
                      <SelectTrigger id="returnLocation">
                        <SelectValue placeholder="Select return location" />
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
                    <span className="ml-2 text-sm text-muted-foreground">(Return Location)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="quantityReturned">Quantity Returned</Label>
                  <span className="text-sm text-muted-foreground">
                    {selectedSale ? `Out of ${selectedSale.quantity} distributed` : ""}
                  </span>
                </div>
                <Input
                  id="quantityReturned"
                  type="number"
                  min="0"
                  max={selectedSale?.quantity || 0}
                  value={quantityReturned}
                  onChange={(e) => setQuantityReturned(Number.parseInt(e.target.value) || 0)}
                />
                {selectedSale && quantityReturned < selectedSale.quantity && (
                  <p className="text-xs text-amber-500">
                    {selectedSale.quantity - quantityReturned} cores will be marked as missing
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about the returned cores"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || !selectedSale}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Record Core Return"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
