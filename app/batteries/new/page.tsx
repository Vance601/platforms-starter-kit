"use client"

import type React from "react"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CANONICAL_BATTERY_TYPES, normalizeBatteryType } from "@/lib/battery-types"

type LocationOpt = { id: string; name: string; companyName: string }
type ModelOpt = { code: string; displayName: string | null; classification: string }

export default function NewBatteryPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locations, setLocations] = useState<LocationOpt[]>([])
  const [classifications, setClassifications] = useState<string[]>([])
  const [models, setModels] = useState<ModelOpt[]>([])
  const [formData, setFormData] = useState({
    type: "",
    model: "",
    serialNumber: "",
    cost: "",
    locationId: "",
    notes: "",
  })

  useEffect(() => {
    // Same option source as Receive Order: real locations, battery_types and
    // battery_models from the DB -- no hardcoded chemistry list.
    fetch("/api/receive-order/options")
      .then((r) => r.json())
      .then((j) => {
        if (j?.error) throw new Error(j.error)
        setLocations(j.locations ?? [])
        const types = (j.classifications ?? []).map((c: string) => normalizeBatteryType(c))
        setClassifications(types.length ? Array.from(new Set<string>(types)) : [...CANONICAL_BATTERY_TYPES])
        setModels(
          (j.models ?? []).map((m: ModelOpt) => ({ ...m, classification: normalizeBatteryType(m.classification) }))
        )
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load options"))
  }, [])

  const filteredModels = useMemo(
    () => models.filter((m) => !formData.type || m.classification === formData.type),
    [models, formData.type]
  )

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value, ...(field === "type" ? { model: "" } : {}) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!formData.locationId || !formData.model) {
      setError("Location and model are required.")
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/batteries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: formData.locationId,
          batteryModelCode: formData.model,
          serialNumber: formData.serialNumber || null,
          cost: formData.cost || null,
          notes: formData.notes || null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j?.success) throw new Error(j?.error || `Save failed (${res.status})`)
      router.push("/batteries")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href="/batteries">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Add New Battery</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Battery Information</CardTitle>
            <CardDescription>Adds one battery to warehouse stock with a generated barcode</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="type">Battery Type</Label>
                <Select value={formData.type} onValueChange={(v) => handleChange("type", v)}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {classifications.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select value={formData.model} onValueChange={(v) => handleChange("model", v)} required>
                  <SelectTrigger id="model">
                    <SelectValue placeholder={filteredModels.length ? "Select model" : "No models"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredModels.map((m) => (
                      <SelectItem key={m.code} value={m.code}>
                        {m.displayName || m.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serialNumber">Serial Number (optional)</Label>
                <Input
                  id="serialNumber"
                  placeholder="Enter serial number"
                  value={formData.serialNumber}
                  onChange={(e) => handleChange("serialNumber", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost">Cost (optional, defaults to model cost)</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 105.00"
                  value={formData.cost}
                  onChange={(e) => handleChange("cost", e.target.value)}
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="location">Location</Label>
                <Select value={formData.locationId} onValueChange={(v) => handleChange("locationId", v)} required>
                  <SelectTrigger id="location">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.companyName} — {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Enter any additional notes"
                rows={4}
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Link href="/batteries">
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Battery"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
