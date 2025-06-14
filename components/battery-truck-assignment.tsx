"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useInventoryStore } from "@/lib/inventory-store"
import { toast } from "@/components/ui/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { AlertCircle, CheckCircle, Truck, Battery, MinusCircle, PlusCircle, MapPin } from "lucide-react"

export function BatteryTruckAssignment() {
  const { inventory, trucks, assignBatteryToTruck, getTruckById } = useInventoryStore()
  const [selectedTruck, setSelectedTruck] = useState<string | null>(null)
  const [selectedBatteryType, setSelectedBatteryType] = useState<string>("")
  const [selectedBatteryModel, setSelectedBatteryModel] = useState<string>("")
  const [quantity, setQuantity] = useState<number>(0)
  const [notes, setNotes] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [availableBatteryModels, setAvailableBatteryModels] = useState<string[]>([])
  const [maxAvailableQuantity, setMaxAvailableQuantity] = useState<number>(0)
  const [truckLocation, setTruckLocation] = useState<string | null>(null)
  const [inventoryStatus, setInventoryStatus] = useState<string>("")

  // Ensure trucks array is valid and sort it
  const availableTrucks = Array.isArray(trucks)
    ? [...trucks]
        .filter((truck) => truck && truck.fleetNumber) // Ensure valid truck objects
        .sort((a, b) => {
          // Sort by fleet number (numeric part if possible)
          const aNum = Number.parseInt(a.fleetNumber.replace(/\D/g, ""))
          const bNum = Number.parseInt(b.fleetNumber.replace(/\D/g, ""))

          if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum
          }
          return a.fleetNumber.localeCompare(b.fleetNumber)
        })
    : []

  // Get unique battery types from inventory
  const availableBatteryTypes = Array.from(new Set((inventory || []).map((item) => item.type)))

  // Update available models when battery type changes
  useEffect(() => {
    if (selectedBatteryType) {
      const models = (inventory || []).filter((item) => item.type === selectedBatteryType).map((item) => item.model)
      setAvailableBatteryModels([...new Set(models)]) // Use Set to remove duplicates

      // Reset selected model if it's not in the new list of models
      if (models.length > 0 && !models.includes(selectedBatteryModel)) {
        setSelectedBatteryModel(models[0])
      }
    } else {
      setAvailableBatteryModels([])
      setSelectedBatteryModel("")
    }
  }, [selectedBatteryType, inventory, selectedBatteryModel])

  // Update truck location when selected truck changes
  useEffect(() => {
    if (selectedTruck) {
      const truck = getTruckById(selectedTruck)
      const location = truck?.location?.toLowerCase() || null
      setTruckLocation(location)

      // Reset battery selections when truck changes
      if (selectedBatteryType && selectedBatteryModel) {
        updateAvailableQuantity(selectedBatteryType, selectedBatteryModel, location)
      }
    } else {
      setTruckLocation(null)
      setMaxAvailableQuantity(0)
    }
  }, [selectedTruck, getTruckById])

  // Update max available quantity when truck location, battery type, or model changes
  useEffect(() => {
    if (selectedBatteryType && selectedBatteryModel && truckLocation) {
      updateAvailableQuantity(selectedBatteryType, selectedBatteryModel, truckLocation)
    } else {
      setMaxAvailableQuantity(0)
      setInventoryStatus("")
    }
  }, [selectedBatteryType, selectedBatteryModel, truckLocation, inventory])

  // Function to update available quantity based on selections
  const updateAvailableQuantity = (batteryType: string, batteryModel: string, location: string | null) => {
    if (!location) {
      setMaxAvailableQuantity(0)
      setInventoryStatus("")
      return
    }

    const inventoryItem = (inventory || []).find((item) => item.type === batteryType && item.model === batteryModel)

    if (!inventoryItem) {
      setMaxAvailableQuantity(0)
      setInventoryStatus(`No ${batteryType} ${batteryModel} batteries found in inventory`)
      return
    }

    const locationKey = location.toLowerCase() as "broadway" | "camelback"
    const availableQuantity = inventoryItem.locations?.[locationKey] || 0

    setMaxAvailableQuantity(availableQuantity)

    if (availableQuantity === 0) {
      setInventoryStatus(`No ${batteryType} ${batteryModel} batteries available at ${location}`)
    } else if (availableQuantity < 5) {
      setInventoryStatus(
        `Low inventory: Only ${availableQuantity} ${batteryType} ${batteryModel} batteries at ${location}`,
      )
    } else {
      setInventoryStatus(`${availableQuantity} ${batteryType} ${batteryModel} batteries available at ${location}`)
    }

    // Only reset quantity if it's more than available
    if (quantity > availableQuantity) {
      setQuantity(Math.min(quantity, availableQuantity))
    }
  }

  // Reset selected truck when trucks array changes
  useEffect(() => {
    // If the selected truck is no longer in the trucks array, reset it
    if (selectedTruck && !availableTrucks.some((truck) => truck.id === selectedTruck)) {
      setSelectedTruck(null)
    }
  }, [trucks, selectedTruck, availableTrucks])

  // Debug: Log trucks when they change
  useEffect(() => {
    console.log("Available trucks for dropdown:", availableTrucks.length)
    console.log(
      "Truck locations:",
      availableTrucks.map((t) => t.location),
    )
  }, [availableTrucks])

  // Check if there's enough inventory available
  const checkInventoryAvailability = () => {
    if (!selectedBatteryType || !selectedBatteryModel || !truckLocation) return false

    const inventoryItem = (inventory || []).find(
      (item) => item.type === selectedBatteryType && item.model === selectedBatteryModel,
    )

    if (!inventoryItem) return false

    const locationKey = truckLocation.toLowerCase() as "broadway" | "camelback"
    const availableQuantity = inventoryItem.locations?.[locationKey] || 0

    return availableQuantity >= quantity && quantity > 0
  }

  const handleQuantityChange = (newQuantity: number) => {
    // Ensure quantity is between 0 and max available
    const validQuantity = Math.max(0, Math.min(newQuantity, maxAvailableQuantity))
    setQuantity(validQuantity)
  }

  const incrementQuantity = () => {
    if (quantity < maxAvailableQuantity) {
      setQuantity(quantity + 1)
    }
  }

  const decrementQuantity = () => {
    if (quantity > 0) {
      setQuantity(quantity - 1)
    }
  }

  const handleAssignBattery = async () => {
    setError(null)

    if (!selectedTruck || !selectedBatteryType || !selectedBatteryModel) {
      setError("Please select a truck, battery type, and battery model")
      return
    }

    if (quantity <= 0) {
      setError("Quantity must be greater than zero")
      return
    }

    if (!checkInventoryAvailability()) {
      setError("Not enough inventory available at the truck's location")
      return
    }

    setLoading(true)

    try {
      assignBatteryToTruck(
        selectedTruck,
        {
          type: selectedBatteryType,
          model: selectedBatteryModel,
          location: truckLocation,
        },
        quantity,
        "current-user",
        notes,
      )

      toast({
        title: "Batteries assigned successfully",
        description: `${quantity} ${selectedBatteryType} ${selectedBatteryModel} batteries assigned to truck`,
        action: <ToastAction altText="OK">OK</ToastAction>,
      })

      // Reset form
      setSelectedTruck(null)
      setSelectedBatteryType("")
      setSelectedBatteryModel("")
      setQuantity(0)
      setNotes("")
      setTruckLocation(null)
      setInventoryStatus("")
    } catch (err) {
      console.error("Error assigning batteries:", err)
      setError("Failed to assign batteries. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Get location display name
  const getLocationDisplayName = (location: string | null) => {
    if (!location) return "Unknown"
    return location.charAt(0).toUpperCase() + location.slice(1)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Battery className="mr-2 h-5 w-5" />
            Assign Batteries to Trucks
          </CardTitle>
          <CardDescription>Assign batteries from inventory to trucks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-start mb-4">
              <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="truck">Select Truck</Label>
              <Select value={selectedTruck || ""} onValueChange={setSelectedTruck}>
                <SelectTrigger id="truck">
                  <SelectValue placeholder="Select a truck" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {availableTrucks.length === 0 ? (
                    <SelectItem value="no-trucks" disabled>
                      No trucks available
                    </SelectItem>
                  ) : (
                    availableTrucks.map((truck) => (
                      <SelectItem key={truck.id} value={truck.id}>
                        {truck.fleetNumber} - {truck.make} {truck.model} ({truck.location})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {truckLocation && (
                <div className="flex items-center mt-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3 mr-1" />
                  Location: {getLocationDisplayName(truckLocation)}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="batteryType">Battery Type</Label>
              <Select value={selectedBatteryType} onValueChange={setSelectedBatteryType} disabled={!selectedTruck}>
                <SelectTrigger id="batteryType">
                  <SelectValue placeholder={!selectedTruck ? "Select a truck first" : "Select battery type"} />
                </SelectTrigger>
                <SelectContent>
                  {availableBatteryTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batteryModel">Battery Model</Label>
              <Select
                value={selectedBatteryModel}
                onValueChange={setSelectedBatteryModel}
                disabled={!selectedBatteryType || availableBatteryModels.length === 0}
              >
                <SelectTrigger id="batteryModel">
                  <SelectValue
                    placeholder={
                      !selectedBatteryType
                        ? "Select battery type first"
                        : availableBatteryModels.length === 0
                          ? "No models available"
                          : "Select battery model"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableBatteryModels.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={decrementQuantity}
                  disabled={quantity <= 0 || maxAvailableQuantity <= 0}
                  className="h-10 w-10"
                >
                  <MinusCircle className="h-4 w-4" />
                </Button>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  max={maxAvailableQuantity}
                  value={quantity}
                  onChange={(e) => handleQuantityChange(Number(e.target.value))}
                  className="mx-2 text-center"
                  disabled={maxAvailableQuantity <= 0}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={incrementQuantity}
                  disabled={quantity >= maxAvailableQuantity || maxAvailableQuantity <= 0}
                  className="h-10 w-10"
                >
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </div>
              {inventoryStatus && (
                <p
                  className={`text-xs ${maxAvailableQuantity === 0 ? "text-red-500" : maxAvailableQuantity < 5 ? "text-amber-500" : "text-muted-foreground"}`}
                >
                  {inventoryStatus}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input
              id="notes"
              placeholder="Add any notes about this assignment"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {selectedTruck && selectedBatteryType && selectedBatteryModel && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md flex items-start">
              <Truck className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Assignment Preview</p>
                <p className="text-sm">
                  Assigning {quantity} {selectedBatteryType} {selectedBatteryModel} batteries to{" "}
                  {getTruckById(selectedTruck)?.fleetNumber} at {getLocationDisplayName(truckLocation)}
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={handleAssignBattery}
            disabled={
              !selectedTruck ||
              !selectedBatteryType ||
              !selectedBatteryModel ||
              quantity <= 0 ||
              loading ||
              maxAvailableQuantity <= 0
            }
            className="w-full md:w-auto"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Assigning...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Assign Battery
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
