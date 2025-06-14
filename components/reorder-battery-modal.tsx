"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertCircle, CheckCircle, Loader2, Building2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

interface ReorderBatteryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onReorder: (batteryType: string, location: string, quantity: number) => void
}

export function ReorderBatteryModal({ open, onOpenChange, onReorder }: ReorderBatteryModalProps) {
  const [batteryType, setBatteryType] = useState<string>("Alpha")
  const [location, setLocation] = useState<string>("Broadway")
  const [quantity, setQuantity] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)

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
        onReorder(batteryType, location, quantity)
        setIsSubmitting(false)
        setSuccess(true)

        // Close the modal after showing success message
        setTimeout(() => {
          setSuccess(false)
          onOpenChange(false)
          setQuantity(0)
        }, 1500)
      } catch (err) {
        setIsSubmitting(false)
        setError("Failed to update inventory. Please try again.")
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Receive Battery Order</DialogTitle>
          <DialogDescription>Update inventory when new batteries are received.</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6">
            <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>
                {quantity} {batteryType} batteries have been added to the {location} location.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="batteryType">Battery Type</Label>
                <Select value={batteryType} onValueChange={setBatteryType}>
                  <SelectTrigger id="batteryType">
                    <SelectValue placeholder="Select battery type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alpha">
                      <div className="flex items-center">
                        <Badge variant="outline" className={getBatteryBadgeClass("Alpha")}>
                          Alpha
                        </Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="Bravo">
                      <div className="flex items-center">
                        <Badge variant="outline" className={getBatteryBadgeClass("Bravo")}>
                          Bravo
                        </Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="Charlie">
                      <div className="flex items-center">
                        <Badge variant="outline" className={getBatteryBadgeClass("Charlie")}>
                          Charlie
                        </Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="AMG">
                      <div className="flex items-center">
                        <Badge variant="outline" className={getBatteryBadgeClass("AMG")}>
                          AMG
                        </Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <Tabs defaultValue={location} onValueChange={setLocation} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="Broadway" className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-blue-500" />
                      Broadway
                    </TabsTrigger>
                    <TabsTrigger value="Camelback" className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-green-500" />
                      Camelback
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity Received</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity || ""}
                  onChange={(e) => setQuantity(Number.parseInt(e.target.value) || 0)}
                  placeholder="Enter quantity"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="orderNumber">Order Number (Optional)</Label>
                <Input id="orderNumber" placeholder="Enter order reference number" />
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
                  "Update Inventory"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
