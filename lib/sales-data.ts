// Mock sales data for reports
export type SaleRecord = {
  id: string
  date: string
  batteryType: "Alpha" | "Bravo" | "Charlie" | "AMG"
  quantity: number
  price: number
  teamMemberId: string
  teamMemberName: string
  location: "Broadway" | "Camelback"
}

// Generate random sales data for the past year
export function generateSalesData(): SaleRecord[] {
  const batteryTypes = ["Alpha", "Bravo", "Charlie", "AMG"] as const
  const locations = ["Broadway", "Camelback"] as const
  const teamMembers = [
    { id: "TM001", name: "John Doe" },
    { id: "TM002", name: "Sarah Miller" },
    { id: "TM003", name: "Robert Chen" },
    { id: "TM004", name: "Maria Garcia" },
    { id: "TM005", name: "James Wilson" },
  ]

  // Battery prices
  const batteryPrices = {
    Alpha: 250,
    Bravo: 320,
    Charlie: 180,
    AMG: 450,
  }

  const sales: SaleRecord[] = []

  // Generate sales for the past 12 months
  const endDate = new Date()
  const startDate = new Date(endDate)
  startDate.setFullYear(startDate.getFullYear() - 1)

  // Generate 500 random sales records
  for (let i = 0; i < 500; i++) {
    const saleDate = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()))
    const batteryType = batteryTypes[Math.floor(Math.random() * batteryTypes.length)]
    const quantity = Math.floor(Math.random() * 5) + 1 // 1-5 batteries per sale
    const teamMember = teamMembers[Math.floor(Math.random() * teamMembers.length)]
    const location = locations[Math.floor(Math.random() * locations.length)]

    sales.push({
      id: `SALE-${i.toString().padStart(4, "0")}`,
      date: saleDate.toISOString().split("T")[0],
      batteryType,
      quantity,
      price: batteryPrices[batteryType] * quantity,
      teamMemberId: teamMember.id,
      teamMemberName: teamMember.name,
      location,
    })
  }

  // Sort by date, newest first
  return sales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

// Get sales data from localStorage or generate new data
export function getSalesData(): SaleRecord[] {
  if (typeof window === "undefined") return []

  const storedSales = localStorage.getItem("salesData")
  if (storedSales) {
    return JSON.parse(storedSales)
  }

  const newSales = generateSalesData()
  localStorage.setItem("salesData", JSON.stringify(newSales))
  return newSales
}

// Filter sales data by date range
export function filterSalesByDateRange(sales: SaleRecord[], startDate: string, endDate: string): SaleRecord[] {
  return sales.filter((sale) => {
    return sale.date >= startDate && sale.date <= endDate
  })
}

// Get sales by battery type
export function getSalesByBatteryType(sales: SaleRecord[]) {
  const result = {
    Alpha: { quantity: 0, revenue: 0 },
    Bravo: { quantity: 0, revenue: 0 },
    Charlie: { quantity: 0, revenue: 0 },
    AMG: { quantity: 0, revenue: 0 },
  }

  sales.forEach((sale) => {
    result[sale.batteryType].quantity += sale.quantity
    result[sale.batteryType].revenue += sale.price
  })

  return result
}

// Get sales by team member
export function getSalesByTeamMember(sales: SaleRecord[]) {
  const result: Record<string, { id: string; name: string; quantity: number; revenue: number }> = {}

  sales.forEach((sale) => {
    if (!result[sale.teamMemberId]) {
      result[sale.teamMemberId] = {
        id: sale.teamMemberId,
        name: sale.teamMemberName,
        quantity: 0,
        revenue: 0,
      }
    }

    result[sale.teamMemberId].quantity += sale.quantity
    result[sale.teamMemberId].revenue += sale.price
  })

  return Object.values(result).sort((a, b) => b.revenue - a.revenue)
}

// Get sales by location
export function getSalesByLocation(sales: SaleRecord[]) {
  const result = {
    Broadway: { quantity: 0, revenue: 0 },
    Camelback: { quantity: 0, revenue: 0 },
  }

  sales.forEach((sale) => {
    result[sale.location].quantity += sale.quantity
    result[sale.location].revenue += sale.price
  })

  return result
}

// Get monthly sales data for charts
export function getMonthlySalesData(sales: SaleRecord[]) {
  const monthlyData: Record<
    string,
    {
      month: string
      Alpha: number
      Bravo: number
      Charlie: number
      AMG: number
      total: number
    }
  > = {}

  // Initialize monthly data for the past 12 months
  const today = new Date()
  for (let i = 0; i < 12; i++) {
    const date = new Date(today)
    date.setMonth(date.getMonth() - i)
    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`
    const monthName = date.toLocaleString("default", { month: "short", year: "numeric" })

    monthlyData[monthKey] = {
      month: monthName,
      Alpha: 0,
      Bravo: 0,
      Charlie: 0,
      AMG: 0,
      total: 0,
    }
  }

  // Aggregate sales by month and battery type
  sales.forEach((sale) => {
    const [year, month] = sale.date.split("-")
    const monthKey = `${year}-${month}`

    if (monthlyData[monthKey]) {
      monthlyData[monthKey][sale.batteryType] += sale.quantity
      monthlyData[monthKey].total += sale.quantity
    }
  })

  // Convert to array and sort by date
  return Object.values(monthlyData).reverse()
}
