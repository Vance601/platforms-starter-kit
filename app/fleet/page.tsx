"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, Truck as TruckIcon, Battery, RotateCcw, User, Warehouse } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Truck = {
  id: string
  truck_number: string
  year_model: string | null
  vin_last5: string | null
  active: boolean
  company_name: string | null
  current_driver_id: string | null
  current_driver_name: string | null
  batteries_on_truck: number
  owed_cores: number
}

type LocationOverview = {
  id: string
  name: string
  company_name: string | null
  in_warehouse: number
  returned_cores: number
  breakdown: { code: string; n: number }[]
}

const COMPANIES = [
  { slug: "phx",    label: "Duggers PHX / ERS" },
  { slug: "abq",    label: "Duggers ABQ" },
  { slug: "tucson", label: "Express Roadside Tucson" },
]

export default function FleetPage() {
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [locations, setLocations] = useState<LocationOverview[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newNumber, setNewNumber] = useState("")
  const [newYearModel, setNewYearModel] = useState("")
  const [newVinLast5, setNewVinLast5] = useState("")
  const [newCompany, setNewCompany] = useState("phx")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  function loadAll() {
    setIsLoading(true)
    Promise.all([
      fetch("/api/trucks/overview",    { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/locations/overview", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([truckJson, locJson]) => {
        if (truckJson?.success && Array.isArray(truckJson.trucks))    setTrucks(truckJson.trucks)
        if (locJson?.success   && Array.isArray(locJson.locations))   setLocations(locJson.locations)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadAll()
  }, [])

  function openDialog() {
    setNewNumber("")
    setNewYearModel("")
    setNewVinLast5("")
    setNewCompany("phx")
    setFormError("")
    setIsDialogOpen(true)
  }

  async function handleSave() {
    setFormError("")
    if (!newNumber.trim()) {
      setFormError("Truck number is required.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/trucks/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          truckNumber: newNumber.trim(),
          yearModel:   newYearModel.trim(),
          vinLast5:    newVinLast5.trim(),
          companySlug: newCompany,
        }),
      })
      const j = await res.json()
      if (j?.success) {
        setIsDialogOpen(false)
        loadAll()
      } else {
        setFormError(j?.error || "Could not add truck.")
      }
    } catch {
      setFormError("Could not add truck.")
    } finally {
      setSaving(false)
    }
  }

  const q = searchQuery.toLowerCase()
  const filtered = q
    ? trucks.filter(
        (t) =>
          t.truck_number.toLowerCase().includes(q) ||
          (t.year_model ?? "").toLowerCase().includes(q) ||
          (t.current_driver_name ?? "").toLowerCase().includes(q),
      )
    : trucks

  const totalTrucks      = trucks.length
  const activeTrucks     = trucks.filter((t) => t.active).length
  const trucksWithDriver = trucks.filter((t) => !!t.current_driver_id).length
  const totalOnTruck     = trucks.reduce((sum, t) => sum + (t.batteries_on_truck || 0), 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dugger&apos;s Battery Program</h1>
        <Button onClick={openDialog}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Truck
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <p className="text-lg text-muted-foreground">Loading live operations data…</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Trucks</CardTitle>
                <TruckIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalTrucks}</div>
                <p className="text-xs text-muted-foreground">Across all companies</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Trucks</CardTitle>
                <TruckIcon className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeTrucks}</div>
                <p className="text-xs text-muted-foreground">Currently in service</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Claimed Trucks</CardTitle>
                <User className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{trucksWithDriver}</div>
                <p className="text-xs text-muted-foreground">With a driver on shift</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Batteries On Trucks</CardTitle>
                <Battery className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOnTruck}</div>
                <p className="text-xs text-muted-foreground">Live, all trucks combined</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-4 mb-2">
            <div className="relative flex-1">
              <Input
                placeholder="Search by truck #, year/model, driver..."
                className="w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                {trucks.length === 0 ? "No trucks in the database yet." : "No trucks match your search."}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t) => {
                const hasDriver = !!t.current_driver_id
                const hasCargo  = t.batteries_on_truck > 0
                const hasOwed   = t.owed_cores > 0
                return (
                  <Card key={t.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">Truck #{t.truck_number}</CardTitle>
                          <CardDescription>
                            {t.year_model || "—"}
                            {t.vin_last5 ? ` · VIN …${t.vin_last5}` : ""}
                          </CardDescription>
                        </div>
                        <Badge variant={t.active ? "default" : "outline"}>
                          {t.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center text-sm">
                        <User className="mr-2 h-4 w-4 text-muted-foreground" />
                        {hasDriver ? (
                          <span className="font-medium">{t.current_driver_name}</span>
                        ) : (
                          <span className="text-muted-foreground">No driver claimed</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className={`rounded-md border p-3 ${hasCargo ? "bg-amber-50 border-amber-200" : ""}`}>
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Battery className="mr-1 h-3 w-3" />
                            Batteries on truck
                          </div>
                          <div className="text-xl font-semibold mt-1">{t.batteries_on_truck}</div>
                        </div>
                        <div className={`rounded-md border p-3 ${hasOwed ? "bg-red-50 border-red-200" : ""}`}>
                          <div className="flex items-center text-xs text-muted-foreground">
                            <RotateCcw className="mr-1 h-3 w-3" />
                            Cores owed (driver)
                          </div>
                          <div className="text-xl font-semibold mt-1">{t.owed_cores}</div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground pt-1">
                        {t.company_name || "Unassigned company"}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          <div className="mt-8">
            <div className="mb-3 flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold tracking-tight">Warehouse Locations</h2>
            </div>
            {locations.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No locations in the database yet.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {locations.map((l) => {
                  const hasStock    = l.in_warehouse > 0
                  const hasCores    = l.returned_cores > 0
                  const sortedBreak = [...l.breakdown].sort((a, b) => b.n - a.n)
                  return (
                    <Card key={l.id}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">{l.name}</CardTitle>
                        <CardDescription>{l.company_name || "—"}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className={`rounded-md border p-3 ${hasStock ? "bg-blue-50 border-blue-200" : ""}`}>
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Battery className="mr-1 h-3 w-3" />
                              In warehouse
                            </div>
                            <div className="text-xl font-semibold mt-1">{l.in_warehouse}</div>
                          </div>
                          <div className={`rounded-md border p-3 ${hasCores ? "bg-emerald-50 border-emerald-200" : ""}`}>
                            <div className="flex items-center text-xs text-muted-foreground">
                              <RotateCcw className="mr-1 h-3 w-3" />
                              Cores awaiting MBS
                            </div>
                            <div className="text-xl font-semibold mt-1">{l.returned_cores}</div>
                          </div>
                        </div>

                        {sortedBreak.length > 0 ? (
                          <div className="pt-1">
                            <p className="text-xs text-muted-foreground mb-1">By model</p>
                            <div className="flex flex-wrap gap-1.5">
                              {sortedBreak.map((b) => (
                                <Badge key={b.code} variant="outline" className="text-xs">
                                  {b.code}: {b.n}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No in-warehouse stock</p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Truck</DialogTitle>
            <DialogDescription>Add a truck to the fleet.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="truck-number" className="text-sm font-medium">Truck Number *</label>
              <Input
                id="truck-number"
                placeholder="e.g. 138"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="truck-year-model" className="text-sm font-medium">Year / Model</label>
              <Input
                id="truck-year-model"
                placeholder="e.g. 2024 Ford Maverick"
                value={newYearModel}
                onChange={(e) => setNewYearModel(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="truck-vin" className="text-sm font-medium">VIN (last 5)</label>
              <Input
                id="truck-vin"
                placeholder="e.g. 87849"
                value={newVinLast5}
                onChange={(e) => setNewVinLast5(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="truck-company" className="text-sm font-medium">Company</label>
              <select
                id="truck-company"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {COMPANIES.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.label}</option>
                ))}
              </select>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
