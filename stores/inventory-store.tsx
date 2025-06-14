import { create } from "zustand"
import { persist } from "zustand/middleware"

// Define inventory status types
export type InventoryStatus = "pending" | "verified" | "assigned" | "sold" | "returned" | "holding"
export type LocationType = "broadway" | "camelback"
export type BatteryCategory = "Alpha" | "Bravo" | "Charlie" | "AMG"

interface InventoryItem {
  id: string
  type: BatteryCategory | string
  model: string
  quantity: number
  location: string
  status: InventoryStatus
  receivedDate: string
  verifiedDate?: string
  verifiedBy?: string
  holdReason?: string
  notes?: string
}

interface BatteryItem {
  id: string
  type: string
  model: string
  serial: string
  status: string
  location: string
  assignedDate: string
  assignedBy?: string
  notes?: string
}

interface TruckInventory {
  id: string
  fleetNumber: string
  make: string
  model: string
  year: number
  licensePlate: string
  vin: string
  status: string
  location: string
  batteryType: string
  lastService: string
  nextService: string
  batteryInventory: BatteryItem[]
  cores?: {
    id: string
    type: string
    quantity: number
    notes?: string
    timestamp: string
  }[]
}

interface InventoryHistory {
  id: string
  type: string
  model?: string
  quantity: number
  location: string
  action: "received" | "verified" | "assigned" | "returned" | "sold" | "hold"
  timestamp: string
  truckId?: string
  userId?: string
  notes?: string
}

interface InventoryState {
  inventory: {
    id: string
    type: string
    model: string
    totalCount: number
    locations: {
      broadway: number
      camelback: number
    }
  }[]
  pendingInventory: InventoryItem[]
  holdInventory: InventoryItem[]
  verifiedInventory: InventoryItem[]
  trucks: TruckInventory[]
  inventoryHistory: InventoryHistory[]
  hasSampleData: boolean
  parLevels: {
    Alpha: number
    Bravo: number
    Charlie: number
    AMG: number
  }

  // Actions
  receiveInventory: (
    items: { type: string; model: string; quantity: number; location: string; status?: string; notes?: string }[],
  ) => void
  verifyInventory: (itemId: string, userId?: string) => void
  holdInventory: (itemId: string, reason: string, userId?: string) => void
  assignBatteryToTruck: (truckId: string, batteryDetails: any, quantity: number, userId?: string) => void
  removeBatteryFromTruck: (truckId: string, batteryId: string, reason: "sold" | "returned", notes?: string) => void
  addCoresToTruck: (truckId: string, coreData: any) => void
  updateBatteryParLevel: (batteryType: string, newParLevel: number) => void

  // Utility functions
  getAvailableInventory: (location?: string, type?: string, onlyVerified?: boolean) => any[]
  getInventoryByLocation: (location: string) => any[]
  getInventoryHistory: (filters?: { location?: string; type?: string; action?: string }) => InventoryHistory[]
  getTruckById: (truckId: string) => TruckInventory | undefined
  getPendingInventoryCount: (location?: string) => number
  getHoldInventoryCount: (location?: string) => number
  getInventoryByType: (type: string) => any
}

// Sample initial users
const initialInventory = [
  {
    id: "inv-001",
    type: "Alpha",
    model: "S35-Express",
    totalCount: 15,
    locations: {
      broadway: 10,
      camelback: 5,
    },
  },
  {
    id: "inv-002",
    type: "Bravo",
    model: "S75-Express",
    totalCount: 8,
    locations: {
      broadway: 3,
      camelback: 5,
    },
  },
  {
    id: "inv-003",
    type: "Charlie",
    model: "S100-Express",
    totalCount: 12,
    locations: {
      broadway: 7,
      camelback: 5,
    },
  },
  {
    id: "inv-004",
    type: "AMG",
    model: "MX-H6/L3/48-Express",
    totalCount: 6,
    locations: {
      broadway: 2,
      camelback: 4,
    },
  },
]

const initialPendingInventory: InventoryItem[] = [
  {
    id: "pending-001",
    type: "Alpha",
    model: "S35-Express",
    quantity: 5,
    location: "broadway",
    status: "pending",
    receivedDate: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  },
  {
    id: "pending-002",
    type: "Bravo",
    model: "S75-Express",
    quantity: 3,
    location: "camelback",
    status: "pending",
    receivedDate: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
  },
]

const initialHoldInventory: InventoryItem[] = [
  {
    id: "hold-001",
    type: "Charlie",
    model: "S100-Express",
    quantity: 4,
    location: "broadway",
    status: "holding",
    receivedDate: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    holdReason: "Damaged packaging, waiting for inspection",
  },
  {
    id: "hold-002",
    type: "AMG",
    model: "MX-H6/L3/48-Express",
    quantity: 2,
    location: "camelback",
    status: "holding",
    receivedDate: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
    holdReason: "Incorrect model received, awaiting vendor response",
  },
]

const initialTrucks: TruckInventory[] = [
  {
    id: "TRK-001",
    fleetNumber: "F-1001",
    make: "Ford",
    model: "F-150",
    year: 2022,
    licensePlate: "ABC-1234",
    vin: "1FTEW1EP5MFA12345",
    status: "Active",
    location: "Broadway",
    batteryType: "Alpha",
    lastService: "2023-03-15",
    nextService: "2023-06-15",
    batteryInventory: [
      {
        id: "bat-001-1",
        type: "Alpha",
        model: "S35-Express",
        serial: "S35-Express-12345",
        status: "installed",
        location: "Broadway",
        assignedDate: "2023-03-15T09:30:00Z",
      },
      {
        id: "bat-001-2",
        type: "Bravo",
        model: "S75-Express",
        serial: "S75-Express-54321",
        status: "inventory",
        location: "Broadway",
        assignedDate: "2023-03-28T14:45:00Z",
      },
    ],
    cores: [
      {
        id: "core-001-1",
        type: "Alpha",
        quantity: 2,
        notes: "Customer trade-in",
        timestamp: "2023-04-01T14:30:00Z",
      },
    ],
  },
  {
    id: "TRK-002",
    fleetNumber: "F-1002",
    make: "Chevrolet",
    model: "Silverado",
    year: 2021,
    licensePlate: "XYZ-5678",
    vin: "1GCUYDED5MZ123456",
    status: "Active",
    location: "Camelback",
    batteryType: "Bravo",
    lastService: "2023-02-20",
    nextService: "2023-05-20",
    batteryInventory: [
      {
        id: "bat-002-1",
        type: "Bravo",
        model: "S75-Express",
        serial: "S75-Express-23456",
        status: "installed",
        location: "Camelback",
        assignedDate: "2023-03-10T08:15:00Z",
      },
    ],
    cores: [],
  },
  {
    id: "TRK-003",
    fleetNumber: "F-1003",
    make: "Ram",
    model: "1500",
    year: 2023,
    licensePlate: "DEF-9012",
    vin: "1C6SRFFT4MN234567",
    status: "Maintenance",
    location: "Broadway",
    batteryType: "Charlie",
    lastService: "2023-04-01",
    nextService: "2023-07-01",
    batteryInventory: [],
    cores: [],
  },
  {
    id: "TRK-004",
    fleetNumber: "F-1004",
    make: "Toyota",
    model: "Tundra",
    year: 2022,
    licensePlate: "GHI-3456",
    vin: "5TFUY5F10NX345678",
    status: "Active",
    location: "Camelback",
    batteryType: "AMG",
    lastService: "2023-03-10",
    nextService: "2023-06-10",
    batteryInventory: [
      {
        id: "bat-004-1",
        type: "AMG",
        model: "MX-H6/L3/48-Express",
        serial: "MX-H6-34567",
        status: "installed",
        location: "Camelback",
        assignedDate: "2023-03-05T08:15:00Z",
      },
      {
        id: "bat-004-2",
        type: "Charlie",
        model: "S100-Express",
        serial: "S100-34567",
        status: "inventory",
        location: "Camelback",
        assignedDate: "2023-03-22T16:30:00Z",
      },
    ],
    cores: [
      {
        id: "core-004-1",
        type: "Bravo",
        quantity: 1,
        notes: "Customer trade-in",
        timestamp: "2023-03-28T09:15:00Z",
      },
      {
        id: "core-004-2",
        type: "Charlie",
        quantity: 3,
        timestamp: "2023-04-02T16:45:00Z",
      },
    ],
  },
]

const initialHistory: InventoryHistory[] = [
  {
    id: "hist-001",
    type: "Alpha",
    model: "S35-Express",
    quantity: 5,
    location: "broadway",
    action: "received",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "hist-002",
    type: "Bravo",
    model: "S75-Express",
    quantity: 3,
    location: "camelback",
    action: "received",
    timestamp: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: "hist-003",
    type: "Charlie",
    model: "S100-Express",
    quantity: 4,
    location: "broadway",
    action: "hold",
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    notes: "Damaged packaging, waiting for inspection",
  },
]

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      inventory: initialInventory,
      pendingInventory: initialPendingInventory,
      holdInventory: initialHoldInventory,
      verifiedInventory: [],
      trucks: initialTrucks,
      inventoryHistory: initialHistory,
      hasSampleData: true, // Set to true since we're initializing with sample data
      parLevels: {
        Alpha: 40,
        Bravo: 80,
        Charlie: 50,
        AMG: 15,
      },

      receiveInventory: (items) =>
        set((state) => {
          if (!Array.isArray(items)) {
            console.error("receiveInventory: items is not an array", items)
            return state
          }

          const timestamp = new Date().toISOString()
          const newPendingItems = items.map((item, index) => ({
            id: `pending-${Date.now()}-${index}`,
            type: item.type,
            model: item.model,
            quantity: item.quantity,
            location: item.location.toLowerCase(),
            status: (item.status as InventoryStatus) || "pending",
            receivedDate: timestamp,
            notes: item.notes,
          }))

          const newHistoryItems = items.map((item, index) => ({
            id: `hist-${Date.now()}-${index}`,
            type: item.type,
            model: item.model,
            quantity: item.quantity,
            location: item.location.toLowerCase(),
            action: item.status === "holding" ? ("hold" as const) : ("received" as const),
            timestamp,
            notes: item.notes,
          }))

          const pendingItems = newPendingItems.filter((item) => item.status === "pending")
          const holdItems = newPendingItems.filter((item) => item.status === "holding")

          return {
            pendingInventory: [
              ...(Array.isArray(state.pendingInventory) ? state.pendingInventory : []),
              ...pendingItems,
            ],
            holdInventory: [...(Array.isArray(state.holdInventory) ? state.holdInventory : []), ...holdItems],
            inventoryHistory: [
              ...(Array.isArray(state.inventoryHistory) ? state.inventoryHistory : []),
              ...newHistoryItems,
            ],
          }
        }),

      verifyInventory: (itemId, userId) =>
        set((state) => {
          if (!Array.isArray(state.pendingInventory) || !Array.isArray(state.holdInventory)) {
            console.error("verifyInventory: pendingInventory or holdInventory is not an array")
            return state
          }

          const pendingItem =
            state.pendingInventory.find((item) => item.id === itemId) ||
            state.holdInventory.find((item) => item.id === itemId)

          if (!pendingItem) {
            console.error("verifyInventory: item not found", itemId)
            return state
          }

          const verificationDate = new Date().toISOString()

          const updatedInventory = Array.isArray(state.inventory) ? [...state.inventory] : []
          let inventoryUpdated = false

          for (let i = 0; i < updatedInventory.length; i++) {
            if (updatedInventory[i].type === pendingItem.type && updatedInventory[i].model === pendingItem.model) {
              const updatedLocations = { ...updatedInventory[i].locations }
              const locationKey = pendingItem.location.toLowerCase() as "broadway" | "camelback"
              updatedLocations[locationKey] = (updatedLocations[locationKey] || 0) + pendingItem.quantity

              updatedInventory[i] = {
                ...updatedInventory[i],
                totalCount: updatedInventory[i].totalCount + pendingItem.quantity,
                locations: updatedLocations,
              }
              inventoryUpdated = true
              break
            }
          }

          if (!inventoryUpdated) {
            const locationKey = pendingItem.location.toLowerCase() as "broadway" | "camelback"
            updatedInventory.push({
              id: `inv-${Date.now()}`,
              type: pendingItem.type,
              model: pendingItem.model,
              totalCount: pendingItem.quantity,
              locations: {
                broadway: locationKey === "broadway" ? pendingItem.quantity : 0,
                camelback: locationKey === "camelback" ? pendingItem.quantity : 0,
              },
            })
          }

          const verifiedItem = {
            ...pendingItem,
            status: "verified" as const,
            verifiedDate: verificationDate,
            verifiedBy: userId,
          }

          const historyItem = {
            id: `hist-${Date.now()}`,
            type: pendingItem.type,
            model: pendingItem.model,
            quantity: pendingItem.quantity,
            location: pendingItem.location,
            action: "verified" as const,
            timestamp: verificationDate,
            userId,
          }

          const updatedPendingInventory = Array.isArray(state.pendingInventory)
            ? state.pendingInventory.filter((item) => item.id !== itemId)
            : []
          const updatedHoldInventory = Array.isArray(state.holdInventory)
            ? state.holdInventory.filter((item) => item.id !== itemId)
            : []

          return {
            inventory: updatedInventory,
            pendingInventory: updatedPendingInventory,
            holdInventory: updatedHoldInventory,
            verifiedInventory: [
              ...(Array.isArray(state.verifiedInventory) ? state.verifiedInventory : []),
              verifiedItem,
            ],
            inventoryHistory: [...(Array.isArray(state.inventoryHistory) ? state.inventoryHistory : []), historyItem],
          }
        }),

      holdInventory: (itemId, reason, userId) =>
        set((state) => {
          if (!Array.isArray(state.pendingInventory)) {
            console.error("holdInventory: pendingInventory is not an array")
            return state
          }

          const pendingItem = state.pendingInventory.find((item) => item.id === itemId)

          if (!pendingItem) return state

          const timestamp = new Date().toISOString()

          const holdItem = {
            ...pendingItem,
            id: `hold-${Date.now()}`,
            status: "holding" as const,
            holdReason: reason,
          }

          const historyItem = {
            id: `hist-${Date.now()}`,
            type: pendingItem.type,
            model: pendingItem.model,
            quantity: pendingItem.quantity,
            location: pendingItem.location,
            action: "hold" as const,
            timestamp,
            userId,
            notes: reason,
          }

          const updatedPendingInventory = state.pendingInventory.filter((item) => item.id !== itemId)

          return {
            pendingInventory: updatedPendingInventory,
            holdInventory: [...(Array.isArray(state.holdInventory) ? state.holdInventory : []), holdItem],
            inventoryHistory: [...(Array.isArray(state.inventoryHistory) ? state.inventoryHistory : []), historyItem],
          }
        }),

      assignBatteryToTruck: (truckId, batteryDetails, quantity, userId) =>
        set((state) => {
          if (!Array.isArray(state.trucks) || !Array.isArray(state.inventory)) {
            console.error("assignBatteryToTruck: trucks or inventory is not an array")
            return state
          }

          const truckIndex = state.trucks.findIndex((t) => t.id === truckId)
          if (truckIndex === -1) return state

          const truck = state.trucks[truckIndex]
          const { type, model, location } = batteryDetails
          const timestamp = new Date().toISOString()

          const inventoryItem = state.inventory.find((item) => item.type === type && (item.model === model || !model))

          if (!inventoryItem) return state

          const locationKey = location.toLowerCase() as "broadway" | "camelback"
          const availableQuantity = inventoryItem.locations[locationKey] || 0

          if (availableQuantity < quantity) {
            console.error(`Not enough inventory available. Requested: ${quantity}, Available: ${availableQuantity}`)
            return state
          }

          const newBatteries = Array.from({ length: quantity }, (_, i) => ({
            id: `bat-${truckId}-${Date.now()}-${i}`,
            type,
            model: model || inventoryItem.model,
            serial: `${model || inventoryItem.model}-${location.substring(0, 3)}-${Date.now()}-${i}`,
            status: "inventory",
            location,
            assignedDate: timestamp,
            assignedBy: userId,
          }))

          const updatedTrucks = [...state.trucks]
          updatedTrucks[truckIndex] = {
            ...truck,
            batteryInventory: Array.isArray(truck.batteryInventory)
              ? [...truck.batteryInventory, ...newBatteries]
              : [...newBatteries],
          }

          const updatedInventory = state.inventory.map((item) => {
            if (item.type === type && (item.model === model || !model)) {
              const updatedLocations = { ...item.locations }
              updatedLocations[locationKey] = Math.max(0, updatedLocations[locationKey] - quantity)

              return {
                ...item,
                totalCount: item.totalCount - quantity,
                locations: updatedLocations,
              }
            }
            return item
          })

          const historyItem = {
            id: `hist-${Date.now()}`,
            type,
            model: model || inventoryItem.model,
            quantity,
            location,
            action: "assigned" as const,
            timestamp,
            truckId,
            userId,
          }

          return {
            trucks: updatedTrucks,
            inventory: updatedInventory,
            inventoryHistory: [...(Array.isArray(state.inventoryHistory) ? state.inventoryHistory : []), historyItem],
          }
        }),

      removeBatteryFromTruck: (truckId, batteryId, reason, notes) =>
        set((state) => {
          if (!Array.isArray(state.trucks)) {
            console.error("removeBatteryFromTruck: trucks is not an array")
            return state
          }

          const truckIndex = state.trucks.findIndex((t) => t.id === truckId)
          if (truckIndex === -1) return state

          const truck = state.trucks[truckIndex]

          if (!Array.isArray(truck.batteryInventory)) {
            console.error("removeBatteryFromTruck: truck.batteryInventory is not an array")
            return state
          }

          const batteryIndex = truck.batteryInventory.findIndex((b) => b.id === batteryId)
          if (batteryIndex === -1) return state

          const battery = truck.batteryInventory[batteryIndex]
          const timestamp = new Date().toISOString()

          const updatedBatteryInventory = [...truck.batteryInventory]
          updatedBatteryInventory.splice(batteryIndex, 1)

          const updatedTrucks = [...state.trucks]
          updatedTrucks[truckIndex] = {
            ...truck,
            batteryInventory: updatedBatteryInventory,
          }

          const updatedInventory = Array.isArray(state.inventory) ? [...state.inventory] : []
          if (reason === "returned") {
            const locationKey = battery.location.toLowerCase() as "broadway" | "camelback"
            let inventoryUpdated = false

            for (let i = 0; i < updatedInventory.length; i++) {
              if (updatedInventory[i].type === battery.type && updatedInventory[i].model === battery.model) {
                const updatedLocations = { ...updatedInventory[i].locations }
                updatedLocations[locationKey] = (updatedLocations[locationKey] || 0) + 1

                updatedInventory[i] = {
                  ...updatedInventory[i],
                  totalCount: updatedInventory[i].totalCount + 1,
                  locations: updatedLocations,
                }
                inventoryUpdated = true
                break
              }
            }

            if (!inventoryUpdated) {
              updatedInventory.push({
                id: `inv-${Date.now()}`,
                type: battery.type,
                model: battery.model,
                totalCount: 1,
                locations: {
                  broadway: locationKey === "broadway" ? 1 : 0,
                  camelback: locationKey === "camelback" ? 1 : 0,
                },
              })
            }
          }

          const updatedCores = Array.isArray(truck.cores) ? [...truck.cores] : []
          if (reason === "sold") {
            updatedCores.push({
              id: `core-${truckId}-${Date.now()}`,
              type: battery.type,
              quantity: 1,
              notes: notes || "Sold to customer",
              timestamp,
            })

            updatedTrucks[truckIndex] = {
              ...updatedTrucks[truckIndex],
              cores: updatedCores,
            }
          }

          const historyItem = {
            id: `hist-${Date.now()}`,
            type: battery.type,
            model: battery.model,
            quantity: 1,
            location: battery.location,
            action: reason,
            timestamp,
            truckId,
            notes,
          }

          return {
            trucks: updatedTrucks,
            inventory: updatedInventory,
            inventoryHistory: [...(Array.isArray(state.inventoryHistory) ? state.inventoryHistory : []), historyItem],
          }
        }),

      addCoresToTruck: (truckId, coreData) =>
        set((state) => {
          if (!Array.isArray(state.trucks)) {
            console.error("addCoresToTruck: trucks is not an array")
            return state
          }

          const truckIndex = state.trucks.findIndex((t) => t.id === truckId)
          if (truckIndex === -1) return state

          const timestamp = new Date().toISOString()
          const coreId = `core-${truckId}-${Date.now()}`

          const newCore = {
            id: coreId,
            type: coreData.type,
            quantity: coreData.quantity,
            notes: coreData.notes,
            timestamp: timestamp,
          }

          const updatedTrucks = [...state.trucks]
          updatedTrucks[truckIndex] = {
            ...updatedTrucks[truckIndex],
            cores: Array.isArray(updatedTrucks[truckIndex].cores)
              ? [...updatedTrucks[truckIndex].cores, newCore]
              : [newCore],
          }

          return {
            trucks: updatedTrucks,
          }
        }),

      updateBatteryParLevel: (batteryType, newParLevel) => {
        set((state) => {
          const updatedParLevels = {
            ...state.parLevels,
            [batteryType]: newParLevel,
          }

          // Also update the par level in the inventory items if they exist
          const updatedInventory = state.inventory.map((item) => {
            if (item.type === batteryType) {
              return {
                ...item,
                parLevel: newParLevel,
              }
            }
            return item
          })

          return {
            ...state,
            parLevels: updatedParLevels,
            inventory: updatedInventory,
          }
        })
      },

      getAvailableInventory: (location, type, onlyVerified = true) => {
        const state = get()

        if (!Array.isArray(state.inventory)) {
          return []
        }

        let availableInventory = state.inventory.flatMap((item) => {
          if (type && item.type !== type) return []

          return Object.entries(item.locations || {}).flatMap(([loc, count]) => {
            if (location && loc !== location.toLowerCase()) return []

            return Array(count)
              .fill(null)
              .map((_, index) => ({
                id: `${item.id}-${loc}-${index}`,
                type: item.type,
                model: item.model,
                location: loc,
                serial: `${item.model}-${loc.substring(0, 3)}-${index + 1000}`,
                status: "verified",
              }))
          })
        })

        if (!onlyVerified) {
          const pendingItems = [
            ...(Array.isArray(state.pendingInventory) ? state.pendingInventory : []),
            ...(Array.isArray(state.holdInventory) ? state.holdInventory : []),
          ]
            .filter((item) => (!type || item.type === type) && (!location || item.location === location?.toLowerCase()))
            .map((item) => ({
              id: item.id,
              type: item.type,
              model: item.model,
              location: item.location,
              quantity: item.quantity,
              status: item.status,
              receivedDate: item.receivedDate,
            }))

          availableInventory = [...availableInventory, ...pendingItems]
        }

        return availableInventory
      },

      getInventoryByLocation: (location) => {
        const state = get()

        if (!Array.isArray(state.inventory)) {
          return []
        }

        if (location === "all") return state.inventory

        return state.inventory
          .map((item) => {
            const locationKey = location.toLowerCase() as "broadway" | "camelback"
            const locationCount = item.locations?.[locationKey] || 0
            return {
              ...item,
              totalCount: locationCount,
              locations: { [locationKey]: locationCount },
            }
          })
          .filter((item) => item.totalCount > 0)
      },

      getInventoryHistory: (filters = {}) => {
        const state = get()

        if (!Array.isArray(state.inventoryHistory)) {
          return []
        }

        return state.inventoryHistory.filter((item) => {
          if (filters.location && item.location !== filters.location.toLowerCase()) return false
          if (filters.type && item.type !== filters.type) return false
          if (filters.action && item.action !== filters.action) return false
          return true
        })
      },

      getTruckById: (truckId) => {
        const trucks = get().trucks
        if (!Array.isArray(trucks)) {
          return undefined
        }
        return trucks.find((truck) => truck.id === truckId)
      },

      getPendingInventoryCount: (location = "all") => {
        const { pendingInventory } = get()

        if (!Array.isArray(pendingInventory)) {
          return 0
        }

        return pendingInventory.reduce((total, item) => {
          if (location === "all" || item.location === location.toLowerCase()) {
            return total + (item.quantity || 0)
          }
          return total
        }, 0)
      },

      getHoldInventoryCount: (location = "all") => {
        const { holdInventory } = get()

        if (!Array.isArray(holdInventory)) {
          return 0
        }

        return holdInventory.reduce((total, item) => {
          if (location === "all" || item.location === location.toLowerCase()) {
            return total + (item.quantity || 0)
          }
          return total
        }, 0)
      },
      getInventoryByType: (type) => {
        const state = get()

        if (!Array.isArray(state.inventory)) {
          return null
        }

        return state.inventory.find((item) => item.type === type)
      },
    }),
    {
      name: "inventory-storage",
      partialize: (state) => ({
        inventory: state.inventory,
        pendingInventory: state.pendingInventory,
        holdInventory: state.holdInventory,
        verifiedInventory: state.verifiedInventory,
        inventoryHistory: state.inventoryHistory,
        trucks: state.trucks,
        hasSampleData: state.hasSampleData,
      }),
    },
  ),
)
