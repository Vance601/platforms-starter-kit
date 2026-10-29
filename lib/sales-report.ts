// Real sales data for the Reports page (replaces the random mock generator in
// lib/sales-data.ts, which is now only used by the legacy core-returns pages).
import { CANONICAL_BATTERY_TYPES } from "@/lib/battery-types"

export type SaleRecord = {
  id: string
  date: string // YYYY-MM-DD in America/Phoenix
  batteryType: string
  model: string | null
  quantity: number
  price: number // cost of goods
  isWarranty: boolean
  callNumber: string | null
  teamMemberId: string
  teamMemberName: string
  location: string
}

export async function fetchSalesData(start?: string, end?: string): Promise<SaleRecord[]> {
  const qs = new URLSearchParams()
  if (start) qs.set("start", start)
  if (end) qs.set("end", end)
  const res = await fetch(`/api/reports/sales?${qs.toString()}`, { cache: "no-store" })
  const j = await res.json()
  if (!res.ok || !j?.success) throw new Error(j?.error || "Could not load sales")
  return j.sales as SaleRecord[]
}

export function filterSalesByDateRange(sales: SaleRecord[], startDate: string, endDate: string) {
  return sales.filter((s) => s.date >= startDate && s.date <= endDate)
}

type Agg = { quantity: number; revenue: number }

function groupBy(sales: SaleRecord[], key: (s: SaleRecord) => string, seed: string[] = []) {
  const out: Record<string, Agg> = {}
  for (const k of seed) out[k] = { quantity: 0, revenue: 0 }
  for (const s of sales) {
    const k = key(s)
    if (!out[k]) out[k] = { quantity: 0, revenue: 0 }
    out[k].quantity += s.quantity
    out[k].revenue += s.price
  }
  return out
}

export function getSalesByBatteryType(sales: SaleRecord[]) {
  return groupBy(sales, (s) => s.batteryType, [...CANONICAL_BATTERY_TYPES])
}

export function getSalesByLocation(sales: SaleRecord[]) {
  return groupBy(sales, (s) => s.location)
}

export function getSalesByTeamMember(sales: SaleRecord[]) {
  const out: Record<string, { id: string; name: string; quantity: number; revenue: number }> = {}
  for (const s of sales) {
    if (!out[s.teamMemberId]) out[s.teamMemberId] = { id: s.teamMemberId, name: s.teamMemberName, quantity: 0, revenue: 0 }
    out[s.teamMemberId].quantity += s.quantity
    out[s.teamMemberId].revenue += s.price
  }
  return Object.values(out).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
}

export function getMonthlySalesData(sales: SaleRecord[]) {
  const monthly: Record<string, Record<string, string | number>> = {}
  const today = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const row: Record<string, string | number> = {
      month: d.toLocaleString("en-US", { month: "short", year: "numeric" }),
      total: 0,
    }
    for (const t of CANONICAL_BATTERY_TYPES) row[t] = 0
    monthly[key] = row
  }
  for (const s of sales) {
    const row = monthly[s.date.slice(0, 7)]
    if (!row) continue
    row[s.batteryType] = ((row[s.batteryType] as number) || 0) + s.quantity
    row.total = (row.total as number) + s.quantity
  }
  return Object.values(monthly)
}
