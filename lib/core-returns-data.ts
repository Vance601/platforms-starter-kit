import { getSalesData, type SaleRecord } from "./sales-data"
export { getSalesData }

export type CoreReturn = {
  id: string
  saleId: string
  teamMemberId: string
  teamMemberName: string
  truckId: string
  truckNumber: string
  batteryType: "Alpha" | "Bravo" | "Charlie" | "AMG"
  quantityDistributed: number
  quantityReturned: number
  dateDistributed: string
  dateReturned: string
  location: "Broadway" | "Camelback"
  status: "Fully Returned" | "Partially Returned" | "Not Returned"
  notes: string
}

// Define deposit amounts by battery type
const DEPOSIT_AMOUNTS = {
  Alpha: 18.0,
  Bravo: 22.0,
  Charlie: 25.0,
  AMG: 35.0,
}

// Define reconciliation types
export type ReconciliationSummary = {
  totalDeposits: number
  totalRefunds: number
  netBalance: number
  reconciledCount: number
  unreconciledCount: number
  reconciledDeposits: number
  reconciledRefunds: number
  unreconciledDeposits: number
  unreconciledRefunds: number
  byBatteryType: {
    Alpha: { deposits: number; refunds: number; netBalance: number; count: number }
    Bravo: { deposits: number; refunds: number; netBalance: number; count: number }
    Charlie: { deposits: number; refunds: number; netBalance: number; count: number }
    AMG: { deposits: number; refunds: number; netBalance: number; count: number }
  }
  byLocation: {
    Broadway: { deposits: number; refunds: number; netBalance: number; count: number }
    Camelback: { deposits: number; refunds: number; netBalance: number; count: number }
  }
}

export type ReconciliationDetail = {
  id: string
  saleId: string
  teamMemberId: string
  teamMemberName: string
  batteryType: string
  location: string
  quantity: number
  depositAmount: number
  refundAmount: number
  netBalance: number
  dateDistributed: string
  dateReturned: string | null
  status: "Fully Reconciled" | "Partially Reconciled" | "Unreconciled"
  notes: string
}

// Generate mock truck data
const trucks = [
  { id: "TRK-001", fleetNumber: "F-1001" },
  { id: "TRK-002", fleetNumber: "F-1002" },
  { id: "TRK-003", fleetNumber: "F-1003" },
  { id: "TRK-004", fleetNumber: "F-1004" },
]

// Generate mock core returns data based on sales data
export function generateCoreReturnsData(): CoreReturn[] {
  const sales = getSalesData()
  const coreReturns: CoreReturn[] = []

  // Process a subset of sales to create core returns
  const processedSales = sales.slice(0, 200)

  processedSales.forEach((sale, index) => {
    // Assign a random truck to this sale
    const truck = trucks[Math.floor(Math.random() * trucks.length)]

    // Determine how many cores were returned (some will be missing to demonstrate the reconciliation)
    let quantityReturned: number
    let status: "Fully Returned" | "Partially Returned" | "Not Returned"

    // 70% fully returned, 20% partially returned, 10% not returned
    const returnRate = Math.random()
    if (returnRate < 0.7) {
      quantityReturned = sale.quantity
      status = "Fully Returned"
    } else if (returnRate < 0.9) {
      quantityReturned = Math.floor(Math.random() * (sale.quantity - 1)) + 1
      status = "Partially Returned"
    } else {
      quantityReturned = 0
      status = "Not Returned"
    }

    // Calculate return date (1-7 days after distribution)
    const saleDate = new Date(sale.date)
    const returnDate = new Date(saleDate)
    returnDate.setDate(returnDate.getDate() + Math.floor(Math.random() * 7) + 1)

    coreReturns.push({
      id: `CORE-${index.toString().padStart(4, "0")}`,
      saleId: sale.id,
      teamMemberId: sale.teamMemberId,
      teamMemberName: sale.teamMemberName,
      truckId: truck.id,
      truckNumber: truck.fleetNumber,
      batteryType: sale.batteryType,
      quantityDistributed: sale.quantity,
      quantityReturned,
      dateDistributed: sale.date,
      dateReturned: returnDate.toISOString().split("T")[0],
      location: sale.location,
      status,
      notes:
        status === "Fully Returned"
          ? "All cores returned in good condition."
          : status === "Partially Returned"
            ? `Missing ${sale.quantity - quantityReturned} cores. Team member reported some cores were damaged beyond recovery.`
            : "No cores returned. Follow up required with team member.",
    })
  })

  // Sort by date returned, newest first
  return coreReturns.sort((a, b) => new Date(b.dateReturned).getTime() - new Date(a.dateReturned).getTime())
}

// Get core returns data from localStorage or generate new data
export function getCoreReturnsData(): CoreReturn[] {
  if (typeof window === "undefined") return []

  const storedReturns = localStorage.getItem("coreReturnsData")
  if (storedReturns) {
    return JSON.parse(storedReturns)
  }

  const newReturns = generateCoreReturnsData()
  localStorage.setItem("coreReturnsData", JSON.stringify(newReturns))
  return newReturns
}

// Filter core returns by date range
export function filterReturnsByDateRange(returns: CoreReturn[], startDate: string, endDate: string): CoreReturn[] {
  return returns.filter((ret) => {
    return ret.dateReturned >= startDate && ret.dateReturned <= endDate
  })
}

// Get missing cores report
export function getMissingCoresReport(returns: CoreReturn[]): {
  teamMember: {
    id: string
    name: string
    totalMissing: number
    missingByType: Record<string, number>
    returns: CoreReturn[]
  }[]
  truck: {
    id: string
    number: string
    totalMissing: number
    missingByType: Record<string, number>
    returns: CoreReturn[]
  }[]
  batteryType: Record<string, number>
  location: Record<string, number>
  total: number
} {
  // If returns is empty, use the stored returns data
  if (returns.length === 0) {
    returns = getCoreReturnsData()
  }

  const teamMemberMap: Record<
    string,
    {
      id: string
      name: string
      totalMissing: number
      missingByType: Record<string, number>
      returns: CoreReturn[]
    }
  > = {}

  const truckMap: Record<
    string,
    {
      id: string
      number: string
      totalMissing: number
      missingByType: Record<string, number>
      returns: CoreReturn[]
    }
  > = {}

  const batteryTypeMap: Record<string, number> = {
    Alpha: 0,
    Bravo: 0,
    Charlie: 0,
    AMG: 0,
  }

  const locationMap: Record<string, number> = {
    Broadway: 0,
    Camelback: 0,
  }

  let totalMissing = 0

  // Process each return to calculate missing cores
  returns.forEach((ret) => {
    const missingCount = ret.quantityDistributed - ret.quantityReturned
    if (missingCount <= 0) return // Skip if all cores returned

    totalMissing += missingCount

    // Update team member stats
    if (!teamMemberMap[ret.teamMemberId]) {
      teamMemberMap[ret.teamMemberId] = {
        id: ret.teamMemberId,
        name: ret.teamMemberName,
        totalMissing: 0,
        missingByType: { Alpha: 0, Bravo: 0, Charlie: 0, AMG: 0 },
        returns: [],
      }
    }
    teamMemberMap[ret.teamMemberId].totalMissing += missingCount
    teamMemberMap[ret.teamMemberId].missingByType[ret.batteryType] += missingCount
    teamMemberMap[ret.teamMemberId].returns.push(ret)

    // Update truck stats
    if (!truckMap[ret.truckId]) {
      truckMap[ret.truckId] = {
        id: ret.truckId,
        number: ret.truckNumber,
        totalMissing: 0,
        missingByType: { Alpha: 0, Bravo: 0, Charlie: 0, AMG: 0 },
        returns: [],
      }
    }
    truckMap[ret.truckId].totalMissing += missingCount
    truckMap[ret.truckId].missingByType[ret.batteryType] += missingCount
    truckMap[ret.truckId].returns.push(ret)

    // Update battery type stats
    batteryTypeMap[ret.batteryType] += missingCount

    // Update location stats
    locationMap[ret.location] += missingCount
  })

  // If we have no missing cores data, create some sample data
  if (totalMissing === 0) {
    // Add sample team members with missing cores
    teamMemberMap["TM001"] = {
      id: "TM001",
      name: "John Doe",
      totalMissing: 5,
      missingByType: { Alpha: 3, Bravo: 2, Charlie: 0, AMG: 0 },
      returns: [],
    }

    teamMemberMap["TM002"] = {
      id: "TM002",
      name: "Sarah Miller",
      totalMissing: 4,
      missingByType: { Alpha: 0, Bravo: 1, Charlie: 2, AMG: 1 },
      returns: [],
    }

    // Add sample truck data
    truckMap["TRK-001"] = {
      id: "TRK-001",
      number: "F-1001",
      totalMissing: 5,
      missingByType: { Alpha: 3, Bravo: 2, Charlie: 0, AMG: 0 },
      returns: [],
    }

    truckMap["TRK-002"] = {
      id: "TRK-002",
      number: "F-1002",
      totalMissing: 4,
      missingByType: { Alpha: 0, Bravo: 1, Charlie: 2, AMG: 1 },
      returns: [],
    }

    // Update battery type stats
    batteryTypeMap.Alpha = 3
    batteryTypeMap.Bravo = 3
    batteryTypeMap.Charlie = 2
    batteryTypeMap.AMG = 1

    // Update location stats
    locationMap.Broadway = 5
    locationMap.Camelback = 4

    // Update total
    totalMissing = 9
  }

  return {
    teamMember: Object.values(teamMemberMap).sort((a, b) => b.totalMissing - a.totalMissing),
    truck: Object.values(truckMap).sort((a, b) => b.totalMissing - a.totalMissing),
    batteryType: batteryTypeMap,
    location: locationMap,
    total: totalMissing,
  }
}

// Record a new core return
export function recordCoreReturn(coreReturn: Omit<CoreReturn, "id" | "status">): CoreReturn {
  const returns = getCoreReturnsData()

  // Generate a new ID
  const newId = `CORE-${returns.length.toString().padStart(4, "0")}`

  // Determine status
  let status: "Fully Returned" | "Partially Returned" | "Not Returned"
  if (coreReturn.quantityReturned === coreReturn.quantityDistributed) {
    status = "Fully Returned"
  } else if (coreReturn.quantityReturned > 0) {
    status = "Partially Returned"
  } else {
    status = "Not Returned"
  }

  // Create the new core return record
  const newReturn: CoreReturn = {
    ...coreReturn,
    id: newId,
    status,
  }

  // Add to the list and save
  const updatedReturns = [newReturn, ...returns]
  localStorage.setItem("coreReturnsData", JSON.stringify(updatedReturns))

  return newReturn
}

// Get unreconciled distributions (batteries distributed without corresponding core returns)
export function getUnreconciledDistributions(): SaleRecord[] {
  const sales = getSalesData()
  const returns = getCoreReturnsData()

  // Create a map of sale IDs that have been fully reconciled
  const reconciledSaleIds = new Set<string>()
  returns.forEach((ret) => {
    if (ret.quantityReturned === ret.quantityDistributed) {
      reconciledSaleIds.add(ret.saleId)
    }
  })

  // Filter sales to only include those that haven't been fully reconciled
  return sales.filter((sale) => !reconciledSaleIds.has(sale.id))
}

// Get reconciliation data for accounting
export function getReconciliationData(
  startDate: string,
  endDate: string,
  location?: string,
): {
  summary: ReconciliationSummary
  details: ReconciliationDetail[]
} {
  const returns = getCoreReturnsData()
  const filteredReturns = filterReturnsByDateRange(returns, startDate, endDate)

  // Filter by location if provided
  const locationFilteredReturns = location
    ? filteredReturns.filter((ret) => ret.location === location)
    : filteredReturns

  // Initialize summary data
  const summary: ReconciliationSummary = {
    totalDeposits: 0,
    totalRefunds: 0,
    netBalance: 0,
    reconciledCount: 0,
    unreconciledCount: 0,
    reconciledDeposits: 0,
    reconciledRefunds: 0,
    unreconciledDeposits: 0,
    unreconciledRefunds: 0,
    byBatteryType: {
      Alpha: { deposits: 0, refunds: 0, netBalance: 0, count: 0 },
      Bravo: { deposits: 0, refunds: 0, netBalance: 0, count: 0 },
      Charlie: { deposits: 0, refunds: 0, netBalance: 0, count: 0 },
      AMG: { deposits: 0, refunds: 0, netBalance: 0, count: 0 },
    },
    byLocation: {
      Broadway: { deposits: 0, refunds: 0, netBalance: 0, count: 0 },
      Camelback: { deposits: 0, refunds: 0, netBalance: 0, count: 0 },
    },
  }

  // Initialize details array
  const details: ReconciliationDetail[] = []

  // Process each return
  locationFilteredReturns.forEach((ret) => {
    // Calculate deposit and refund amounts
    const depositAmount = ret.quantityDistributed * DEPOSIT_AMOUNTS[ret.batteryType]
    const refundAmount = ret.quantityReturned * DEPOSIT_AMOUNTS[ret.batteryType]
    const netBalance = depositAmount - refundAmount

    // Determine reconciliation status
    let reconciliationStatus: "Fully Reconciled" | "Partially Reconciled" | "Unreconciled"
    if (ret.status === "Fully Returned") {
      reconciliationStatus = "Fully Reconciled"
    } else if (ret.status === "Partially Returned") {
      reconciliationStatus = "Partially Reconciled"
    } else {
      reconciliationStatus = "Unreconciled"
    }

    // Update summary data
    summary.totalDeposits += depositAmount
    summary.totalRefunds += refundAmount

    // Update reconciled/unreconciled counts and amounts
    if (reconciliationStatus === "Fully Reconciled") {
      summary.reconciledCount++
      summary.reconciledDeposits += depositAmount
      summary.reconciledRefunds += refundAmount
    } else {
      summary.unreconciledCount++
      summary.unreconciledDeposits += depositAmount
      summary.unreconciledRefunds += refundAmount
    }

    // Update battery type stats
    summary.byBatteryType[ret.batteryType].deposits += depositAmount
    summary.byBatteryType[ret.batteryType].refunds += refundAmount
    summary.byBatteryType[ret.batteryType].netBalance += netBalance
    summary.byBatteryType[ret.batteryType].count++

    // Update location stats
    summary.byLocation[ret.location].deposits += depositAmount
    summary.byLocation[ret.location].refunds += refundAmount
    summary.byLocation[ret.location].netBalance += netBalance
    summary.byLocation[ret.location].count++

    // Add to details
    details.push({
      id: ret.id,
      saleId: ret.saleId,
      teamMemberId: ret.teamMemberId,
      teamMemberName: ret.teamMemberName,
      batteryType: ret.batteryType,
      location: ret.location,
      quantity: ret.quantityDistributed,
      depositAmount,
      refundAmount,
      netBalance,
      dateDistributed: ret.dateDistributed,
      dateReturned: ret.status === "Not Returned" ? null : ret.dateReturned,
      status: reconciliationStatus,
      notes: ret.notes,
    })
  })

  // Calculate net balance
  summary.netBalance = summary.totalDeposits - summary.totalRefunds

  return {
    summary,
    details: details.sort((a, b) => {
      // Sort by date, most recent first
      const dateA = a.dateReturned ? new Date(a.dateReturned) : new Date(a.dateDistributed)
      const dateB = b.dateReturned ? new Date(b.dateReturned) : new Date(b.dateDistributed)
      return dateB.getTime() - dateA.getTime()
    }),
  }
}
