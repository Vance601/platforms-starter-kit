"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, Building2 } from "lucide-react"
import Link from "next/link"
import { useInventoryStore } from "@/stores/inventory-store"
import { useInventorySummary } from "@/components/inventory-summary"
import { useEffect, useState } from "react"

interface BatteryStatsProps {
  location?: string
  status?: string
}

export function BatteryStats({ location, status }: BatteryStatsProps) {
  const { inventory, trucks } = useInventoryStore()
  const { getCountByType } = useInventorySummary()

  // Generate battery data from inventory store
  const [batteries, setBatteries] = useState<any[]>([])

  useEffect(() => {
    if (!Array.isArray(inventory)) {
      console.warn("Inventory is not an array:", inventory)
      setBatteries([])
      return
    }

    // Generate battery data from inventory
    const batteryTypes = ["Alpha", "Bravo", "Charlie", "AMG"]
    const locations = ["Broadway", "Camelback"]
    const generatedBatteries: any[] = []

    // Generate batteries from warehouse inventory
    batteryTypes.forEach((type) => {
      locations.forEach((loc) => {
        const inventoryItem = inventory.find((item) => item.type === type)
        if (!inventoryItem || !inventoryItem.locations) {
          console.warn(`No inventory item found for type ${type} or missing locations property`)
          return
        }

        const locKey = loc.toLowerCase()
        const count = inventoryItem.locations[locKey] || 0

        // Create a single entry for each battery type at each location
        generatedBatteries.push({
          id: `BAT-${type}-${loc}`,
          type,
          model: inventoryItem.model || "Standard Model",
          currentInventory: count,
          location: loc,
          health: "Good",
          status: "Active",
        })
      })
    })

    // Add batteries from trucks
    if (Array.isArray(trucks)) {
      trucks.forEach((truck) => {
        if (truck && Array.isArray(truck.batteryInventory)) {
          truck.batteryInventory.forEach((battery, index) => {
            if (battery) {
              generatedBatteries.push({
                id: battery.id || `BAT-TRUCK-${truck.id}-${index}`,
                type: battery.type,
                model: battery.model || "Unknown Model",
                currentInventory: 1,
                location: truck.location,
                health: "Good",
                status: "On Truck",
                truckId: truck.id,
                truckNumber: truck.fleetNumber,
              })
            }
          })
        }
      })
    }

    setBatteries(generatedBatteries)
  }, [inventory, trucks])

  // Filter batteries based on props
  let filteredBatteries = batteries

  if (location) {
    filteredBatteries = filteredBatteries.filter((battery) => battery.location === location)
  }

  if (status) {
    filteredBatteries = filteredBatteries.filter((battery) => battery.status === status)
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Battery ID</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Model</TableHead>
          <TableHead>Current Inventory</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredBatteries.map((battery) => (
          <TableRow key={battery.id}>
            <TableCell className="p-2 font-medium">{battery.id}</TableCell>
            <TableCell className="p-2">
              <Badge variant="outline" className={getBatteryBadgeClass(battery.type)}>
                {battery.type}
              </Badge>
            </TableCell>
            <TableCell className="p-2">{battery.model}</TableCell>
            <TableCell className="p-2">{battery.currentInventory} units</TableCell>
            <TableCell className="p-2">
              <Badge variant="outline" className={battery.location === "Broadway" ? "bg-blue-50" : "bg-green-50"}>
                <Building2 className="mr-1 h-3 w-3" />
                {battery.location}
                {battery.truckNumber && ` (Truck ${battery.truckNumber})`}
              </Badge>
            </TableCell>
            <TableCell className="p-2">
              <Badge variant={battery.status === "Active" ? "default" : "destructive"}>{battery.status}</Badge>
            </TableCell>
            <TableCell className="p-2 text-right">
              <Link href={`/batteries/${battery.id}`}>
                <Button variant="ghost" size="icon">
                  <Eye className="h-4 w-4" />
                </Button>
              </Link>
            </TableCell>
          </TableRow>
        ))}

        {filteredBatteries.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
              No batteries found matching your criteria
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
