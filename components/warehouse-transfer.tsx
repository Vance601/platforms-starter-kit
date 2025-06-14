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
import { ArrowRightLeft, Battery, CheckCircle, MapPin, AlertCircle, MinusCircle, PlusCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function WarehouseTransfer() {
  const { inventory, transferInventory } = useInventoryStore()
  const [selectedBatteryType, setSelectedBatteryType] = useState<string>("")
  const [selectedBatteryModel, setSelectedBatteryModel] = useState<string>("")
  const [sourceLocation, setSourceLocation] = useState<string>("")
  const [destinationLocation, setDestinationLocation] = useState<string>("")
  const [quantity, setQuantity] = useState<number>(0)
  const [notes, setNotes] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [availableBatteryModels, setAvailableBatteryModels] = useState<string[]>([])
  const [maxAvailableQuantity, setMaxAvailableQuantity] = useState<number>(0)
  const [recentTransfers, setRecentTransfers] = useState<any[]>([])

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

  // Update max available quantity when source location, battery type, or model changes
  useEffect(() => {
    if (selectedBatteryType && selectedBatteryModel && sourceLocation) {
      updateAvailableQuantity(selectedBatteryType, selectedBatteryModel, sourceLocation)
    } else {
      setMaxAvailableQuantity(0)
    }
  }, [selectedBatteryType, selectedBatteryModel, sourceLocation, inventory])

  // Function to update available quantity based on selections
  const updateAvailableQuantity = (batteryType: string, batteryModel: string, location: string) => {
    if (!location) {
      setMaxAvailableQuantity(0)
      return
    }

    const inventoryItem = (inventory || []).find((item) => item.type === batteryType && item.model === batteryModel)

    if (!inventoryItem) {
      setMaxAvailableQuantity(0)
      return
    }

    const locationKey = location.toLowerCase() as "broadway" | "camelback"
    const availableQuantity = inventoryItem.locations?.[locationKey] || 0

    setMaxAvailableQuantity(availableQuantity)

    // Only reset quantity if it's more than available
    if (quantity > availableQuantity) {
      setQuantity(Math.min(quantity, availableQuantity))
    }
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

  const handleTransfer = async () => {
    setError(null)

    if (!selectedBatteryType || !selectedBatteryModel) {
      setError("Please select a battery type and model")
      return
    }

    if (!sourceLocation) {
      setError("Please select a source location")
      return
    }

    if (!destinationLocation) {
      setError("Please select a destination location")
      return
    }

    if (sourceLocation === destinationLocation) {
      setError("Source and destination locations cannot be the same")
      return
    }

    if (quantity <= 0) {
      setError("Quantity must be greater than zero")
      return
    }

    if (quantity > maxAvailableQuantity) {
      setError(`Only ${maxAvailableQuantity} batteries available at ${sourceLocation}`)
      return
    }

    setLoading(true)

    try {
      // Call the transferInventory function from the store
      transferInventory({
        type: selectedBatteryType,
        model: selectedBatteryModel,
        sourceLocation,
        destinationLocation,
        quantity,
        notes,
      })

      // Add to recent transfers
      const newTransfer = {
        id: `transfer-${Date.now()}`,
        type: selectedBatteryType,
        model: selectedBatteryModel,
        sourceLocation,
        destinationLocation,
        quantity,
        notes,
        timestamp: new Date().toISOString(),
      }

      setRecentTransfers([newTransfer, ...recentTransfers.slice(0, 4)])

      toast({
        title: "Transfer successful",
        description: `${quantity} ${selectedBatteryType} ${selectedBatteryModel} batteries transferred from ${sourceLocation} to ${destinationLocation}`,
        action: <ToastAction altText="OK">OK</ToastAction>,
      })

      // Reset form
      setQuantity(0)
      setNotes("")
    } catch (err) {
      console.error("Error transferring inventory:", err)
      setError("Failed to transfer inventory. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Get location display name
  const getLocationDisplayName = (location: string) => {
    if (!location) return "Unknown"
    return location.charAt(0).toUpperCase() + location.slice(1)
  }

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    try {
      return new Date(dateString).toLocaleString()
    } catch (error) {
      return "Invalid date"
    }
  }

  // Function to calculate total quantity of a battery type at a location
  const getTotalByLocation = (batteryType: string, location: string) => {
    return (inventory || [])
      .filter((item) => item.type === batteryType)
      .reduce((total, item) => {
        const locationKey = location.toLowerCase() as "broadway" | "camelback"
        return total + (item.locations?.[locationKey] || 0)
      }, 0)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ArrowRightLeft className="mr-2 h-5 w-5" />
              Transfer Inventory Between Locations
            </CardTitle>
            <CardDescription>Move batteries from one warehouse to another</CardDescription>
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
                <Label htmlFor="batteryType">Battery Type</Label>
                <Select value={selectedBatteryType} onValueChange={setSelectedBatteryType}>
                  <SelectTrigger id="batteryType">
                    <SelectValue placeholder="Select battery type" />
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
                <Label htmlFor="sourceLocation">Source Location</Label>
                <Select
                  value={sourceLocation}
                  onValueChange={setSourceLocation}
                  disabled={!selectedBatteryType || !selectedBatteryModel}
                >
                  <SelectTrigger id="sourceLocation">
                    <SelectValue placeholder="Select source location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="broadway">Broadway</SelectItem>
                    <SelectItem value="camelback">Camelback</SelectItem>
                  </SelectContent>
                </Select>
                {sourceLocation && selectedBatteryType && selectedBatteryModel && (
                  <p className="text-xs text-muted-foreground">
                    Available: {maxAvailableQuantity} {selectedBatteryType} {selectedBatteryModel} at{" "}
                    {getLocationDisplayName(sourceLocation)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="destinationLocation">Destination Location</Label>
                <Select value={destinationLocation} onValueChange={setDestinationLocation} disabled={!sourceLocation}>
                  <SelectTrigger id="destinationLocation">
                    <SelectValue placeholder="Select destination location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="broadway" disabled={sourceLocation === "broadway"}>
                      Broadway
                    </SelectItem>
                    <SelectItem value="camelback" disabled={sourceLocation === "camelback"}>
                      Camelback
                    </SelectItem>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  placeholder="Add any notes about this transfer"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {sourceLocation && destinationLocation && selectedBatteryType && selectedBatteryModel && quantity > 0 && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md flex items-start">
                <ArrowRightLeft className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Transfer Preview</p>
                  <p className="text-sm">
                    Transferring {quantity} {selectedBatteryType} {selectedBatteryModel} batteries from{" "}
                    {getLocationDisplayName(sourceLocation)} to {getLocationDisplayName(destinationLocation)}
                  </p>
                </div>
              </div>
            )}

            <Button
              onClick={handleTransfer}
              disabled={
                !selectedBatteryType ||
                !selectedBatteryModel ||
                !sourceLocation ||
                !destinationLocation ||
                sourceLocation === destinationLocation ||
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
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Transferring...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Transfer Inventory
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Battery className="mr-2 h-5 w-5" />
              Recent Transfers
            </CardTitle>
            <CardDescription>View your most recent inventory transfers</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTransfers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Battery</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell>
                        <div className="font-medium">{transfer.type}</div>
                        <div className="text-sm text-muted-foreground">{transfer.model}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-amber-100 text-amber-800">
                          <MapPin className="h-3 w-3 mr-1" />
                          {getLocationDisplayName(transfer.sourceLocation)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-100 text-green-800">
                          <MapPin className="h-3 w-3 mr-1" />
                          {getLocationDisplayName(transfer.destinationLocation)}
                        </Badge>
                      </TableCell>
                      <TableCell>{transfer.quantity}</TableCell>
                      <TableCell>{formatDate(transfer.timestamp)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ArrowRightLeft className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No recent transfers</p>
                <p className="text-sm">Transfers you make will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
            Inventory Status
          </CardTitle>
          <CardDescription>Current inventory levels across locations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Broadway Location</h3>
                <div className="space-y-2">
                  {availableBatteryTypes.map((type) => {
                    const count = getTotalByLocation(type, "broadway")
                    return (
                      <div key={`broadway-${type}`} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Battery
                            className={`h-4 w-4 mr-2 ${type.toLowerCase() === "alpha" ? "text-green-500" : type.toLowerCase() === "bravo" ? "text-blue-500" : type.toLowerCase() === "charlie" ? "text-indigo-500" : "text-red-500"}`}
                          />
                          <span>{type}</span>
                        </div>
                        <Badge variant={count < 5 ? "destructive" : "outline"}>{count}</Badge>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Camelback Location</h3>
                <div className="space-y-2">
                  {availableBatteryTypes.map((type) => {
                    const count = getTotalByLocation(type, "camelback")
                    return (
                      <div key={`camelback-${type}`} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Battery
                            className={`h-4 w-4 mr-2 ${type.toLowerCase() === "alpha" ? "text-green-500" : type.toLowerCase() === "bravo" ? "text-blue-500" : type.toLowerCase() === "charlie" ? "text-indigo-500" : "text-red-500"}`}
                          />
                          <span>{type}</span>
                        </div>
                        <Badge variant={count < 5 ? "destructive" : "outline"}>{count}</Badge>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
