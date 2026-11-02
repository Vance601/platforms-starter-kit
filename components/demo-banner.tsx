"use client"

import { useEffect, useState } from "react"

type Info = { isDemo: boolean; expiresAt?: string | null; driverName?: string | null; driverPin?: string | null; driverUrl?: string | null }

// Shown only inside demo orgs: explains it's sample data and gives the driver login.
export default function DemoBanner() {
  const [info, setInfo] = useState<Info | null>(null)
  useEffect(() => {
    fetch("/api/demo/info", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.success && d.isDemo) setInfo(d) })
      .catch(() => {})
  }, [])
  if (!info) return null
  const exp = info.expiresAt ? new Date(info.expiresAt).toLocaleDateString() : null
  return (
    <div className="mb-4 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <strong>Demo mode.</strong> Everything here is sample data for a fictional Las Vegas company
      {exp ? <> and is deleted after {exp}</> : null}. No emails or texts are sent.{" "}
      {info.driverUrl && info.driverPin ? (
        <>
          Try the driver app: open{" "}
          <a className="underline font-medium" href={info.driverUrl} target="_blank" rel="noreferrer">{info.driverUrl}</a>, pick{" "}
          <strong>{info.driverName}</strong> and enter PIN <strong className="font-mono">{info.driverPin}</strong>.
        </>
      ) : null}{" "}
      <a className="underline font-medium" href="/signup">Create your real account</a>
    </div>
  )
}
