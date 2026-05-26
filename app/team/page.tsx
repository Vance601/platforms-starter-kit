"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Users, Building2, PlusCircle, Phone, Pencil, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Driver = {
  id: string
  name: string
  phone: string
  active: boolean
  company: string
  companyId: string
}

type Company = {
  id: string
  name: string
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function TeamPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [companies, setCompanies] = useState<Company[]>([])

  // Add/Edit dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null) // null = adding, id = editing
  const [formName, setFormName] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formCompanyId, setFormCompanyId] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  // Remove confirm dialog state
  const [removeTarget, setRemoveTarget] = useState<Driver | null>(null)
  const [removing, setRemoving] = useState(false)

  function loadDrivers() {
    setIsLoading(true)
    fetch("/api/drivers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.success && Array.isArray(j.drivers)) setDrivers(j.drivers)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }

  function loadCompanies() {
    fetch("/api/companies", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.success && Array.isArray(j.companies)) setCompanies(j.companies)
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadDrivers()
  }, [])

  function openAddDialog() {
    setEditingId(null)
    setFormName("")
    setFormPhone("")
    setFormCompanyId("")
    setFormError("")
    setIsDialogOpen(true)
    loadCompanies()
  }

  function openEditDialog(driver: Driver) {
    setEditingId(driver.id)
    setFormName(driver.name)
    setFormPhone(driver.phone)
    setFormCompanyId(driver.companyId)
    setFormError("")
    setIsDialogOpen(true)
    loadCompanies()
  }

  async function handleSave() {
    setFormError("")
    if (!formName.trim()) {
      setFormError("Name is required.")
      return
    }
    if (!formPhone.trim()) {
      setFormError("Cell number is required.")
      return
    }
    if (!formCompanyId) {
      setFormError("Please select a company.")
      return
    }
    setSaving(true)
    try {
      const endpoint = editingId ? "/api/drivers/update" : "/api/drivers/add"
      const payload = editingId
        ? { id: editingId, name: formName.trim(), phone: formPhone.trim(), companyId: formCompanyId }
        : { name: formName.trim(), phone: formPhone.trim(), companyId: formCompanyId }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const j = await res.json()
      if (j?.success) {
        setIsDialogOpen(false)
        loadDrivers()
      } else {
        setFormError(j?.error || "Could not save driver.")
      }
    } catch {
      setFormError("Could not save driver.")
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!removeTarget) return
    setRemoving(true)
    try {
      const res = await fetch("/api/drivers/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: removeTarget.id }),
      })
      const j = await res.json()
      if (j?.success) {
        setRemoveTarget(null)
        loadDrivers()
      }
    } catch {
      // leave dialog open on failure
    } finally {
      setRemoving(false)
    }
  }

  const query = searchQuery.toLowerCase()
  const filtered = query
    ? drivers.filter(
        (d) =>
          d.name.toLowerCase().includes(query) ||
          d.company.toLowerCase().includes(query) ||
          d.phone.toLowerCase().includes(query),
      )
    : drivers

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Team</h1>
        <Button onClick={openAddDialog}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Driver
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <p className="text-lg text-muted-foreground">Loading…</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-1">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{drivers.length}</div>
                <p className="text-xs text-muted-foreground">Active drivers on the roster</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search drivers..."
                className="pl-8 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Drivers</CardTitle>
              <CardDescription>Live roster from the database</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {filtered.length > 0 ? (
                  filtered.map((driver) => (
                    <div key={driver.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{initials(driver.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium">{driver.name}</h3>
                          <p className="text-sm text-muted-foreground flex items-center">
                            <Building2 className="mr-1 h-3 w-3" />
                            {driver.company}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {driver.phone && (
                          <div className="hidden md:flex items-center text-sm text-muted-foreground">
                            <Phone className="mr-1 h-3 w-3" />
                            {driver.phone}
                          </div>
                        )}
                        <Badge variant={driver.active ? "default" : "outline"}>
                          {driver.active ? "Active" : "Inactive"}
                        </Badge>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(driver)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRemoveTarget(driver)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium">No drivers found</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {drivers.length === 0
                        ? "No active drivers in the database yet."
                        : "Try adjusting your search."}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Driver" : "Add Driver"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update this driver's details." : "Add a new active driver to the roster."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="driver-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="driver-name"
                placeholder="Driver full name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="driver-phone" className="text-sm font-medium">
                Cell Number
              </label>
              <Input
                id="driver-phone"
                placeholder="(555) 123-4567"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Company</label>
              <Select value={formCompanyId} onValueChange={setFormCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Remove confirm dialog */}
      <Dialog open={removeTarget !== null} onOpenChange={(open) => { if (!open) setRemoveTarget(null) }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Remove Driver</DialogTitle>
            <DialogDescription>
              Remove {removeTarget?.name} from the active roster? Their record is kept for history and
              can be restored later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removing}>
              Cancel
            </Button>
            <Button onClick={handleRemove} disabled={removing} className="bg-red-600 hover:bg-red-700">
              {removing ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
