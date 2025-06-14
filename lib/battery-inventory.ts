// Battery inventory data model

export interface BatteryInventory {
  id: string
  type: "Alpha" | "Bravo" | "Charlie" | "AMG"
  model: string
  totalCount: number
  locations: {
    broadway: number
    camelback: number
  }
  avgPower: number
  lastUpdated: string
  price: number
  parLevel?: number // Added par level field
}

// Sample battery inventory data
export const batteryInventory: BatteryInventory[] = [
  {
    id: "bat-001",
    type: "Alpha",
    model: "S35-Express",
    totalCount: 61,
    locations: {
      broadway: 42,
      camelback: 19,
    },
    avgPower: 72,
    lastUpdated: "2025-01-15T10:30:00Z",
    price: 66.92,
    parLevel: 40, // Added default par level
  },
  {
    id: "bat-002",
    type: "Bravo",
    model: "S75-Express",
    totalCount: 92,
    locations: {
      broadway: 45,
      camelback: 47,
    },
    avgPower: 85,
    lastUpdated: "2025-01-16T14:45:00Z",
    price: 70.92,
    parLevel: 80, // Added default par level
  },
  {
    id: "bat-003",
    type: "Charlie",
    model: "S65-Express",
    totalCount: 56,
    locations: {
      broadway: 32,
      camelback: 24,
    },
    avgPower: 65,
    lastUpdated: "2025-01-17T09:15:00Z",
    price: 79.92,
    parLevel: 50, // Added default par level
  },
  {
    id: "bat-004",
    type: "AMG",
    model: "MX-H6/L3/48-Express",
    totalCount: 19,
    locations: {
      broadway: 8,
      camelback: 11,
    },
    avgPower: 78,
    lastUpdated: "2025-01-18T16:20:00Z",
    price: 165.92,
    parLevel: 15, // Added default par level
  },
]

// Function to update battery inventory
export function updateBatteryInventory(
  updates: {
    type: "Alpha" | "Bravo" | "Charlie" | "AMG"
    quantity: number
    location: "broadway" | "camelback"
  }[],
) {
  // In a real app, this would update a database
  // For this example, we'll just log the updates
  console.log("Updating battery inventory:", updates)

  // Return a simulated success response
  return {
    success: true,
    message: "Battery inventory updated successfully",
    updatedItems: updates.length,
  }
}

// Function to update battery par level
export function updateBatteryParLevel(batteryId: string, parLevel: number) {
  // In a real app, this would update a database
  // For this example, we'll just log the updates
  console.log("Updating battery par level:", { batteryId, parLevel })

  // Return a simulated success response
  return {
    success: true,
    message: "Battery par level updated successfully",
  }
}

// Function to get battery type by price
export function getBatteryTypeByPrice(price: number): "Alpha" | "Bravo" | "Charlie" | "AMG" {
  if (price < 70) return "Alpha"
  if (price < 80) return "Bravo"
  if (price < 175) return "Charlie"
  return "AMG"
}

// Function to get battery models by type
export function getBatteryModelsByType(type: "Alpha" | "Bravo" | "Charlie" | "AMG"): string[] {
  const models = {
    Alpha: ["S35-Express", "S51R-Express"],
    Bravo: ["S75-Express", "S86-Express", "S-H5/L2/47-Express"],
    Charlie: ["S24F-Express", "S65-Express"],
    AMG: ["MX-H6/L3/48-Express", "MX-H7/L4/94R-Express", "MX-H8/L5/49-Express"],
  }

  return models[type]
}
