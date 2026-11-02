"use client"
import { useEffect, useState } from "react"

export type OrgCompany = { id: string; slug: string; name: string; createdAt: string | null }

// This org's companies from /api/companies. `defaultSlug` is the org's oldest
// company (its first/primary one), so pickers default the same way per org.
export function useOrgCompanies() {
  const [companies, setCompanies] = useState<OrgCompany[]>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let alive = true
    fetch("/api/companies", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (alive && d?.success) setCompanies((d.companies || []).filter((c: OrgCompany) => c.slug)) })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [])
  const oldest = [...companies].sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""))[0]
  return { companies, loaded, defaultSlug: oldest?.slug || "" }
}
