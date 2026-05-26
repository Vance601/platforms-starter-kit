"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Users, Building2, PlusCircle, Phone } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Driver = {
  id: string
  name: string
  phone: string
  active: boolean
  company: string
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

  // Add Driver dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

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

  useEffect(() => {
    loadDrivers()
  }, [])

  function openDialog() {
    setNewName("")
    setNewPhone("")
    setFormError("")
    setIsDialogOpen(true)
  }

  async function handleSave() {
    setFormError("")
    if (!newName.trim()) {
      setFormError("Name is required.")
      return
    }
    if (!newPhone.trim()) {
      setFormError("Cell number is required.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/drivers/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), phone: newPhone.trim() }),
      })
      const j = await res.json()
      if (j?.success) {
        setIsDialogOpen(false)
        loadDrivers()
      } else {
        setFormError(j?.error || "Could not add driver.")
      }
    } catch {
      setFormError("Could not add driver.")
    } finally {
      setSaving(false)
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
        <Button onClick={openDialog}>
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

      {/* Add Driver dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Driver</DialogTitle>
            <DialogDescription>Add a new active driver to the roster.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="driver-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="driver-name"
                placeholder="Driver full name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="driver-phone" className="text-sm font-medium">
                Cell Number
              </label>
              <Input
                id="driver-phone"
                placeholder="(555) 123-4567"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
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
