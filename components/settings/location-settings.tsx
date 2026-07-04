"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, MapPin, Edit, Trash2 } from "lucide-react"

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

export function LocationSettings() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [newLoc, setNewLoc] = useState({
    name: "",
    companyId: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  })

  const [editLoc, setEditLoc] = useState<Location | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/locations", { cache: "no-store" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Failed to load locations")
      setCompanies(json.companies || [])
      setLocations(json.locations || [])
      if (!newLoc.companyId && json.companies?.length) {
        setNewLoc((prev) => ({ ...prev, companyId: json.companies[0].id }))
      }
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

  function resetNew() {
    setNewLoc({
      name: "",
      companyId: companies.length ? companies[0].id : "",
      address: "",
      city: "",
      state: "",
      zip: "",
    })
  }

  async function handleAdd() {
    setError(null)
    setFlash(null)
    if (!newLoc.name.trim()) {
      setError("Location name is required.")
      return
    }
    if (!newLoc.companyId) {
      setError("Please choose a company.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/locations/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newLoc.name.trim(),
          companyId: newLoc.companyId,
          address: newLoc.address.trim() || undefined,
          city: newLoc.city.trim() || undefined,
          state: newLoc.state.trim() || undefined,
          zip: newLoc.zip.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Failed to add location")
      setFlash(`Location "${json.name}" added.`)
      setIsAddOpen(false)
      resetNew()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add location")
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit() {
    if (!editLoc) return
    setError(null)
    setFlash(null)
    if (!editLoc.name.trim()) {
      setError("Location name is required.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/locations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editLoc.id,
          name: editLoc.name.trim(),
          address: (editLoc.address || "").trim() || undefined,
          city: (editLoc.city || "").trim() || undefined,
          state: (editLoc.state || "").trim() || undefined,
          zip: (editLoc.zip || "").trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Failed to update location")
      setFlash(`Location "${json.name}" updated.`)
      setIsEditOpen(false)
      setEditLoc(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update location")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(loc: Location) {
    const warn =
      loc.battery_count > 0
        ? `"${loc.name}" has ${loc.battery_count} batteries tied to it. It will be marked inactive (hidden), but its history is kept. Continue?`
        : `Mark "${loc.name}" inactive? It will be hidden from pickers but its history is kept.`
    if (!confirm(warn)) return
    setError(null)
    setFlash(null)
    try {
      const res = await fetch("/api/locations/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: loc.id }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Failed to delete location")
      setFlash(`Location "${json.name}" marked inactive.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete location")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Locations</h3>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Location</DialogTitle>
              <DialogDescription>Add a warehouse or service location under one of your companies.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" value={newLoc.name}
                  onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })}
                  className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="company" className="text-right">Company</Label>
                <select id="company" value={newLoc.companyId}
                  onChange={(e) => setNewLoc({ ...newLoc, companyId: e.target.value })}
                  className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select a company...</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="address" className="text-right">Address</Label>
                <Input id="address" value={newLoc.address}
                  onChange={(e) => setNewLoc({ ...newLoc, address: e.target.value })}
                  className="col-span-3" placeholder="optional" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="city" className="text-right">City</Label>
                <Input id="city" value={newLoc.city}
                  onChange={(e) => setNewLoc({ ...newLoc, city: e.target.value })}
                  className="col-span-3" placeholder="optional" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="state" className="text-right">State</Label>
                <Input id="state" value={newLoc.state}
                  onChange={(e) => setNewLoc({ ...newLoc, state: e.target.value })}
                  className="col-span-3" placeholder="optional" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="zip" className="text-right">ZIP</Label>
                <Input id="zip" value={newLoc.zip}
                  onChange={(e) => setNewLoc({ ...newLoc, zip: e.target.value })}
                  className="col-span-3" placeholder="optional" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving}>{saving ? "Adding..." : "Add Location"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {flash && <p className="text-sm text-green-600">{flash}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading && locations.length === 0 ? (
        <div className="text-muted-foreground py-8 text-center">Loading locations...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {locations.map((location) => (
            <Card key={location.id} className={location.active ? "" : "opacity-60"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-muted-foreground" />
                  {location.name}
                </CardTitle>
                <CardDescription>
                  {location.company_name || "Unassigned"}
                  {location.active ? "" : " - Inactive"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground">Address:</p>
                  <p>{[location.address, location.city, location.state, location.zip].filter(Boolean).join(", ") || "No address on file"}</p>
                </div>
                <div className="space-y-1 text-sm mt-2">
                  <p className="text-muted-foreground">Batteries:</p>
                  <p>{location.battery_count}</p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditLoc(location)
                    setIsEditOpen(true)
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => handleDelete(location)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
            <DialogDescription>Update location information.</DialogDescription>
          </DialogHeader>

          {editLoc && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">Name</Label>
                <Input id="edit-name" value={editLoc.name}
                  onChange={(e) => setEditLoc({ ...editLoc, name: e.target.value })}
                  className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-address" className="text-right">Address</Label>
                <Input id="edit-address" value={editLoc.address || ""}
                  onChange={(e) => setEditLoc({ ...editLoc, address: e.target.value })}
                  className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-city" className="text-right">City</Label>
                <Input id="edit-city" value={editLoc.city || ""}
                  onChange={(e) => setEditLoc({ ...editLoc, city: e.target.value })}
                  className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-state" className="text-right">State</Label>
                <Input id="edit-state" value={editLoc.state || ""}
                  onChange={(e) => setEditLoc({ ...editLoc, state: e.target.value })}
                  className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-zip" className="text-right">ZIP</Label>
                <Input id="edit-zip" value={editLoc.zip || ""}
                  onChange={(e) => setEditLoc({ ...editLoc, zip: e.target.value })}
                  className="col-span-3" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
