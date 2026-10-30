"use client"

import { useEffect, useState } from "react"

// Per-organization business settings. Only the owner can save (the API enforces it).
export function OrgSettingsForm() {
  const [prefix, setPrefix] = useState("DG")
  const [tz, setTz] = useState("America/Phoenix")
  const [charge, setCharge] = useState("25")
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/org-settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) {
          setPrefix(d.settings.barcodePrefix)
          setTz(d.settings.timezone)
          setCharge(String(d.settings.coreCharge))
        }
      })
      .catch(() => {})
  }, [])

  async function save() {
    setSaving(true)
    setMsg(null)
    try {
      const r = await fetch("/api/org-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcodePrefix: prefix, timezone: tz, coreCharge: Number(charge) }),
      })
      const d = await r.json().catch(() => ({}))
      setMsg(d?.success ? "Saved." : d?.error || "Could not save.")
    } catch {
      setMsg("Network error.")
    } finally {
      setSaving(false)
    }
  }

  const input = "w-full rounded border px-3 py-2 text-sm"
  return (
    <div className="space-y-3 max-w-md">
      <label className="block text-sm">
        Barcode prefix (new battery and truck labels)
        <input className={input} value={prefix} maxLength={6} onChange={(e) => setPrefix(e.target.value.toUpperCase())} />
      </label>
      <label className="block text-sm">
        Business timezone (IANA name, e.g. America/Phoenix)
        <input className={input} value={tz} onChange={(e) => setTz(e.target.value)} />
      </label>
      <label className="block text-sm">
        Default core charge ($)
        <input className={input} type="number" min="0" step="0.01" value={charge} onChange={(e) => setCharge(e.target.value)} />
      </label>
      <p className="text-xs text-muted-foreground">Existing barcodes and printed labels are not changed. Only the owner can save.</p>
      <button onClick={save} disabled={saving} className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
        {saving ? "Saving..." : "Save"}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  )
}
