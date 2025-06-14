"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, CheckCircle, Loader2, Building2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"

interface AddInventoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  alert: {
    id: string
    type: string
    location: string
    item: string
    level: string
    threshold: number
    current: number
  } | null
  onResolve: (alertId: string, quantity: number, notes: string, location: string) => void
}

export function AddInventoryModal({ open, onOpenChange, alert, onResolve }: AddInventoryModalProps) {
  const [quantity, setQuantity] = useState<number>(0)
  const [notes, setNotes] = useState<string>("")
  const [source, setSource] = useState<string>("new-shipment")
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)
  const [selectedLocation, setSelectedLocation] = useState<string>(alert?.location || "Broadway")
  const [addToReorder, setAddToReorder] = useState<boolean>(true)

  // Reset form when modal opens with a new alert
  useEffect(() => {
    if (open && alert) {
      setSelectedLocation(alert.location)
      // Calculate recommended quantity based on threshold
      const recommendedQuantity = Math.max(alert.threshold - alert.current + 5, 5)
      setQuantity(recommendedQuantity)
      setNotes(`Adding inventory to resolve low stock alert for ${alert.item}`)
      setAddToReorder(true)
    }
  }, [open, alert])

  if (!alert) return null

  const handleSubmit = () => {
    if (quantity <= 0) {
      setError("Please enter a valid quantity")
      return
    }

    setError(null)
    setIsSubmitting(true)

    // Simulate API call
    setTimeout(() => {
      try {
        // Safe call to onResolve with all required parameters
        onResolve(alert.id, quantity, notes, selectedLocation)
        setIsSubmitting(false)
        setSuccess(true)

        // Close the modal after showing success message
        setTimeout(() => {
          setSuccess(false)
          onOpenChange(false)
          setQuantity(0)
          setNotes("")
          setSource("new-shipment")
        }, 1500)
      } catch (err) {
        setIsSubmitting(false)
        setError("Failed to update inventory. Please try again.")
        console.error("Error in handleSubmit:", err)
      }
    }, 1000)
  }

  const recommendedQuantity = Math.max(alert.threshold - alert.current + 5, 5)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Inventory to Resolve Alert</DialogTitle>
          <DialogDescription>Add inventory to resolve the low stock alert for {alert.item}.</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6">
            <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>
                Inventory has been updated at {selectedLocation} location and the alert has been resolved.
                {addToReorder && " This item has been added to the auto-reorder system."}
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <>
            <Tabs defaultValue={alert.location} onValueChange={setSelectedLocation}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="Broadway" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Broadway
                </TabsTrigger>
                <TabsTrigger value="Camelback" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Camelback
                </TabsTrigger>
              </TabsList>

              <TabsContent value="Broadway" className="space-y-4 pt-4">
                <Alert variant={alert.location === "Broadway" ? "destructive" : "default"} className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    {alert.location === "Broadway"
                      ? "This is the location with the alert"
                      : "Adding to a different location"}
                  </AlertTitle>
                  <AlertDescription>
                    {alert.location === "Broadway"
                      ? `Current stock at Broadway: ${alert.current} (Threshold: ${alert.threshold})`
                      : "You're adding inventory to Broadway, but the alert is for Camelback."}
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="item-broadway" className="text-right">
                      Item
                    </Label>
                    <Input id="item-broadway" value={alert.item} className="col-span-3" disabled />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="quantity-broadway" className="text-right">
                      Add Quantity
                    </Label>
                    <div className="col-span-3 space-y-1">
                      <Input
                        id="quantity-broadway"
                        type="number"
                        min="1"
                        value={quantity || ""}
                        onChange={(e) => setQuantity(Number.parseInt(e.target.value) || 0)}
                        placeholder={`Recommended: ${recommendedQuantity}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        Recommended: Add at least {recommendedQuantity} units
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="Camelback" className="space-y-4 pt-4">
                <Alert variant={alert.location === "Camelback" ? "destructive" : "default"} className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    {alert.location === "Camelback"
                      ? "This is the location with the alert"
                      : "Adding to a different location"}
                  </AlertTitle>
                  <AlertDescription>
                    {alert.location === "Camelback"
                      ? `Current stock at Camelback: ${alert.current} (Threshold: ${alert.threshold})`
                      : "You're adding inventory to Camelback, but the alert is for Broadway."}
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="item-camelback" className="text-right">
                      Item
                    </Label>
                    <Input id="item-camelback" value={alert.item} className="col-span-3" disabled />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="quantity-camelback" className="text-right">
                      Add Quantity
                    </Label>
                    <div className="col-span-3 space-y-1">
                      <Input
                        id="quantity-camelback"
                        type="number"
                        min="1"
                        value={quantity || ""}
                        onChange={(e) => setQuantity(Number.parseInt(e.target.value) || 0)}
                        placeholder={`Recommended: ${recommendedQuantity}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        Recommended: Add at least {recommendedQuantity} units
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="source" className="text-right">
                  Source
                </Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger id="source" className="col-span-3">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new-shipment">New Shipment</SelectItem>
                    <SelectItem value="transfer">Transfer from Another Location</SelectItem>
                    <SelectItem value="return">Return to Inventory</SelectItem>
                    <SelectItem value="adjustment">Inventory Adjustment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="notes" className="text-right">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  className="col-span-3"
                  placeholder="Add any additional notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <div className="col-span-1"></div>
                <div className="flex items-center space-x-2 col-span-3">
                  <Checkbox
                    id="add-to-reorder"
                    checked={addToReorder}
                    onCheckedChange={(checked) => setAddToReorder(checked === true)}
                  />
                  <Label htmlFor="add-to-reorder">Add to auto-reorder system</Label>
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
                  "Add Inventory & Resolve"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
