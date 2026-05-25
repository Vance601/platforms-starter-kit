"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Building2, MapPin, PlusCircle, RefreshCw } from "lucide-react"

type Company = { id: string; name: string; slug: string; active: boolean }
type Location = {
  id: string
  name: string
  slug: string
  company_id: string
  company_name: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  active: boolean
  battery_count: number
}

export default function LocationsPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [companyId, setCompanyId] = useState("")
  const [city, setCity] = useState("")
  const [stateVal, setStateVal] = useState("")
  const [address, setAddress] = useState("")
  const [zip, setZip] = useState("")
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/locations", { cache: "no-store" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Failed to load locations")
      setCompanies(json.companies || [])
      setLocations(json.locations || [])
      if (!companyId && json.companies?.length) setCompanyId(json.companies[0].id)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load locations")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAdd = async () => {
    setFlash(null)
    setError(null)
    if (!name.trim()) {
      setError("Location name is required.")
      return
    }
    if (!companyId) {
      setError("Please choose a company.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/locations/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          companyId,
          city: city.trim() || undefined,
          state: stateVal.trim() || undefined,
          address: address.trim() || undefined,
          zip: zip.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Failed to add location")
      setFlash(`Location "${json.name}" added.`)
      setName("")
      setCity("")
      setStateVal("")
      setAddress("")
      setZip("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add location")
    } finally {
      setSaving(false)
    }
  }

  const byCompany: Record<string, Location[]> = {}
  for (const loc of locations) {
    const key = loc.company_name || "Unassigned"
    if (!byCompany[key]) byCompany[key] = []
    byCompany[key].push(loc)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
        <Button variant="outline" className="h-11" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="bg-white border-l-4 border-l-blue-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center">
            <PlusCircle className="mr-2 h-5 w-5 text-blue-500" />
            Add a Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Location name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tucson Main"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Company *</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a company…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">City</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="optional" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">State</label>
              <Input value={stateVal} onChange={(e) => setStateVal(e.target.value)} placeholder="optional" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Address</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="optional" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">ZIP</label>
              <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="optional" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={handleAdd} disabled={saving} className="h-11">
              <PlusCircle className="mr-2 h-5 w-5" />
              {saving ? "Adding…" : "Add Location"}
            </Button>
            {flash && <span className="text-sm text-green-600">{flash}</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </CardContent>
      </Card>

      {loading && locations.length === 0 ? (
        <div className="text-muted-foreground py-8 text-center">Loading locations…</div>
      ) : (
        Object.keys(byCompany).sort().map((company) => (
          <div key={company}>
            <h2 className="text-xl font-semibold mb-3 flex items-center">
              <Building2 className="mr-2 h-5 w-5 text-muted-foreground" />
              {company}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {byCompany[company].map((loc) => (
                <Card key={loc.id} className="bg-white border-l-4 border-l-slate-400">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center">
                      <MapPin className="mr-2 h-5 w-5 text-slate-500" />
                      {loc.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{loc.battery_count}</div>
                    <p className="text-sm text-muted-foreground">batteries</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {[loc.city, loc.state].filter(Boolean).join(", ") || "No address on file"}
                    </p>
                    {!loc.active && (
                      <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                        Inactive
                      </span>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
