"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface AddTruckModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddTruck: (truck: any) => void
}

export function AddTruckModal({ open, onOpenChange, onAddTruck }: AddTruckModalProps) {
  const [formData, setFormData] = useState({
    fleetNumber: "",
    make: "",
    model: "",
    year: new Date().getFullYear(),
    licensePlate: "",
    vin: "",
    status: "Active",
    location: "Broadway",
    batteryType: "Alpha",
    lastService: new Date().toISOString().split("T")[0],
    nextService: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split("T")[0],
  })

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = () => {
    if (!formData.fleetNumber || !formData.make || !formData.model) {
      setError("Please fill in all required fields")
      return
    }

    setError(null)
    setIsSubmitting(true)

    // Add an ID to the truck data
    const truckWithId = {
      ...formData,
      id: `TRK-${Date.now()}`, // Generate a unique ID
      batteryInventory: [],
      cores: [],
    }

    try {
      console.log("Submitting truck data:", truckWithId)
      onAddTruck(truckWithId)
      setIsSubmitting(false)
      setSuccess(true)

      // Close the modal after showing success message
      setTimeout(() => {
        setSuccess(false)
        onOpenChange(false)
        setFormData({
          fleetNumber: "",
          make: "",
          model: "",
          year: new Date().getFullYear(),
          licensePlate: "",
          vin: "",
          status: "Active",
          location: "Broadway",
          batteryType: "Alpha",
          lastService: new Date().toISOString().split("T")[0],
          nextService: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split("T")[0],
        })
      }, 1500)
    } catch (err) {
      console.error("Error in add truck modal:", err)
      setIsSubmitting(false)
      setError("Failed to add truck. Please try again.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Add New Truck</DialogTitle>
          <DialogDescription>Add a new truck to your fleet inventory.</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6">
            <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>The truck has been added to your fleet.</AlertDescription>
            </Alert>
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fleetNumber">Fleet Number *</Label>
                  <Input
                    id="fleetNumber"
                    placeholder="e.g., F-1005"
                    value={formData.fleetNumber}
                    onChange={(e) => handleChange("fleetNumber", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Select value={formData.location} onValueChange={(value) => handleChange("location", value)}>
                    <SelectTrigger id="location">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Broadway">Broadway</SelectItem>
                      <SelectItem value="Camelback">Camelback</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="make">Make *</Label>
                  <Input
                    id="make"
                    placeholder="e.g., Ford"
                    value={formData.make}
                    onChange={(e) => handleChange("make", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Model *</Label>
                  <Input
                    id="model"
                    placeholder="e.g., F-150"
                    value={formData.model}
                    onChange={(e) => handleChange("model", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    placeholder="e.g., 2023"
                    value={formData.year}
                    onChange={(e) => handleChange("year", Number.parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="licensePlate">License Plate</Label>
                  <Input
                    id="licensePlate"
                    placeholder="e.g., ABC-1234"
                    value={formData.licensePlate}
                    onChange={(e) => handleChange("licensePlate", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vin">VIN</Label>
                  <Input
                    id="vin"
                    placeholder="Vehicle Identification Number"
                    value={formData.vin}
                    onChange={(e) => handleChange("vin", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="batteryType">Battery Type</Label>
                  <Select value={formData.batteryType} onValueChange={(value) => handleChange("batteryType", value)}>
                    <SelectTrigger id="batteryType">
                      <SelectValue placeholder="Select battery type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Alpha">Alpha</SelectItem>
                      <SelectItem value="Bravo">Bravo</SelectItem>
                      <SelectItem value="Charlie">Charlie</SelectItem>
                      <SelectItem value="AMG">AMG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => handleChange("status", value)}>
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Maintenance">Maintenance</SelectItem>
                      <SelectItem value="Out of Service">Out of Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lastService">Last Service Date</Label>
                  <Input
                    id="lastService"
                    type="date"
                    value={formData.lastService}
                    onChange={(e) => handleChange("lastService", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nextService">Next Service Date</Label>
                  <Input
                    id="nextService"
                    type="date"
                    value={formData.nextService}
                    onChange={(e) => handleChange("nextService", e.target.value)}
                  />
                </div>
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
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Add Truck"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
