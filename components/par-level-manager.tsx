"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Check, Settings } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { updateBatteryParLevel } from "@/lib/battery-inventory"

interface ParLevelManagerProps {
  batteryId: string
  batteryType: string
  model: string
  currentParLevel?: number
  currentStock: number
  onParLevelUpdated: (batteryId: string, newParLevel: number) => void
}

export function ParLevelManager({
  batteryId,
  batteryType,
  model,
  currentParLevel = 0,
  currentStock,
  onParLevelUpdated,
}: ParLevelManagerProps) {
  const [open, setOpen] = useState(false)
  const [parLevel, setParLevel] = useState(currentParLevel)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      // Update par level in the database/API
      const result = await updateBatteryParLevel(batteryId, parLevel)

      if (result.success) {
        // Update local state
        onParLevelUpdated(batteryId, parLevel)

        // Show success toast
        toast({
          title: "Par level updated",
          description: `Par level for ${batteryType} ${model} has been set to ${parLevel} units.`,
          variant: "default",
        })

        // Close dialog
        setOpen(false)
      } else {
        // Show error toast
        toast({
          title: "Error updating par level",
          description: "There was an error updating the par level. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      // Show error toast
      toast({
        title: "Error updating par level",
        description: "There was an error updating the par level. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get status based on current stock vs par level
  const getStockStatus = () => {
    if (currentStock === 0) return { label: "Out of Stock", variant: "destructive" as const }
    if (currentStock < parLevel) return { label: "Below Par", variant: "destructive" as const }
    if (currentStock === parLevel) return { label: "At Par", variant: "warning" as const }
    if (currentStock <= parLevel * 1.2) return { label: "Near Par", variant: "warning" as const }
    return { label: "Above Par", variant: "default" as const }
  }

  const status = getStockStatus()

  return (
    <>
      <div className="flex items-center gap-2">
        <Badge variant={status.variant}>{status.label}</Badge>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Settings className="h-3.5 w-3.5 mr-1" />
          Set Par
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Set Par Level</DialogTitle>
            <DialogDescription>
              Set the minimum inventory level for {batteryType} {model}. You will be alerted when stock falls below this
              level.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="parLevel" className="text-right">
                Par Level
              </Label>
              <Input
                id="parLevel"
                type="number"
                min="0"
                value={parLevel}
                onChange={(e) => setParLevel(Number.parseInt(e.target.value) || 0)}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Current Stock</Label>
              <div className="col-span-3 flex items-center gap-2">
                <span>{currentStock} units</span>
                {currentStock < parLevel && (
                  <Badge variant="destructive" className="ml-2">
                    <AlertCircle className="h-3.5 w-3.5 mr-1" />
                    {parLevel - currentStock} units below par
                  </Badge>
                )}
                {currentStock >= parLevel && (
                  <Badge variant="default" className="bg-green-500 ml-2">
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {currentStock - parLevel} units above par
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
