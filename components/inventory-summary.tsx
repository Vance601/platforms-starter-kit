"use client"

import { useInventoryStore } from "@/lib/inventory-store"

export function useInventorySummary() {
  const { inventory, pendingInventory, holdInventory, trucks } = useInventoryStore()

  // Get total inventory count
  const totalBatteries = Array.isArray(inventory)
    ? inventory.reduce((total, item) => total + (item.totalCount || 0), 0)
    : 0

  // Get Broadway inventory count
  const broadwayBatteries = Array.isArray(inventory)
    ? inventory.reduce((total, item) => total + (item.locations?.broadway || 0), 0)
    : 0

  // Get Camelback inventory count
  const camelbackBatteries = Array.isArray(inventory)
    ? inventory.reduce((total, item) => total + (item.locations?.camelback || 0), 0)
    : 0

  // Get pending inventory count
  const pendingCount = Array.isArray(pendingInventory)
    ? pendingInventory.reduce((total, item) => total + (item.quantity || 0), 0)
    : 0

  // Get hold inventory count
  const holdCount = Array.isArray(holdInventory)
    ? holdInventory.reduce((total, item) => total + (item.quantity || 0), 0)
    : 0

  // Get total truck battery count
  const totalTruckBatteries = Array.isArray(trucks)
    ? trucks.reduce((total, truck) => {
        return total + (Array.isArray(truck.batteryInventory) ? truck.batteryInventory.length : 0)
      }, 0)
    : 0

  // Get count by type
  const getCountByType = (type: string, location?: string) => {
    if (!Array.isArray(inventory)) {
      return 0
    }

    const item = inventory.find((i) => i.type === type)

    if (!item) {
      return 0
    }

    if (location) {
      const locKey = location.toLowerCase()
      return item.locations && item.locations[locKey] ? item.locations[locKey] : 0
    }

    return item.totalCount || 0
  }

  return {
    totalBatteries,
    broadwayBatteries,
    camelbackBatteries,
    pendingCount,
    holdCount,
    totalTruckBatteries,
    getCountByType,
  }
}
