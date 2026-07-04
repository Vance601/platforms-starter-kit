"use client"

import { useState, useEffect } from "react"

type Supplier = {
  id: string
  name: string
}

export function SupplierManagement() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/suppliers", { cache: "no-store" })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || "Could not load suppliers.")
        return
      }
      setSuppliers(json.suppliers || [])
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function addSupplier() {
    const name = newName.trim()
    if (!name) {
      setError("Enter a supplier name.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error || "Could not add supplier.")
        return
      }
      setNewName("")
      await load()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          These are the suppliers your cores and warranties go back to. Add each
          distributor you buy batteries from. You will pick one when recording a
          warranty pickup or core return.
        </p>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium">Supplier name</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. MBS Solutions"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") addSupplier()
            }}
          />
        </div>
        <button
          onClick={addSupplier}
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Adding..." : "Add
