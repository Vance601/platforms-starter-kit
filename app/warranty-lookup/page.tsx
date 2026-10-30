"use client";

import { useState } from "react";

type Result = {
  customer: string | null;
  vehicle: string | null;
  vinLast6: string | null;
  batteryGroup: string | null;
  installedBy: string | null;
  warrantyStart: string | null;
  warrantyEnd: string | null;
  warrantyMonths: number | null;
  status: "active" | "expired" | "unknown";
};

export default function WarrantyLookupPage() {
  const [mode, setMode] = useState<"phone" | "vin">("phone");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/public/warranty-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "phone" ? { phone: value } : { vin: value }),
      });
      const data = await res.json();
      if (!data.success) setError(data.error || "Lookup failed.");
      else setResults(data.results);
    } catch {
      setError("Network error. Please try again.");
    }
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-slate-900 px-4 py-10 text-slate-50">
      <div className="mx-auto max-w-md space-y-5">
        <h1 className="text-2xl font-bold">Battery warranty lookup</h1>
        <p className="text-sm text-slate-400">
          Look up your battery warranty with the phone number you gave the technician, or your vehicle&apos;s VIN.
        </p>
        <div className="flex gap-2">
          {(["phone", "vin"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setValue(""); setResults(null); setError(null); }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === m ? "bg-blue-600" : "bg-slate-700"}`}
            >
              {m === "phone" ? "Phone number" : "VIN"}
            </button>
          ))}
        </div>
        <form onSubmit={lookup} className="space-y-3">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode={mode === "phone" ? "tel" : "text"}
            placeholder={mode === "phone" ? "(602) 555-0123" : "17-character VIN"}
            className="w-full rounded-lg bg-slate-800 px-4 py-3 font-mono uppercase"
          />
          <button disabled={busy || !value.trim()} className="w-full rounded-lg bg-green-600 py-3 font-semibold disabled:opacity-50">
            {busy ? "Looking up…" : "Look up warranty"}
          </button>
        </form>
        {error ? <p className="rounded-lg bg-red-900 p-3 text-sm text-red-100">{error}</p> : null}
        {results && results.length === 0 ? (
          <p className="rounded-lg bg-slate-800 p-4 text-sm text-slate-300">
            No warranty found. Batteries sold before VIN records started may not show here. Please call the shop.
          </p>
        ) : null}
        {results?.map((r, i) => (
          <div key={i} className="space-y-1 rounded-xl bg-slate-800 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{r.vehicle || "Vehicle"}</span>
              <span className={`rounded px-2 py-0.5 text-xs font-bold ${r.status === "active" ? "bg-green-700" : r.status === "expired" ? "bg-red-800" : "bg-slate-600"}`}>
                {r.status === "active" ? "ACTIVE" : r.status === "expired" ? "EXPIRED" : "UNKNOWN"}
              </span>
            </div>
            {r.customer ? <p className="text-slate-400">Customer: {r.customer}</p> : null}
            {r.vinLast6 ? <p className="text-slate-400">VIN ending {r.vinLast6}</p> : null}
            {r.batteryGroup ? <p>Battery group {r.batteryGroup}</p> : null}
            <p>
              Installed {r.warrantyStart ?? "—"} · Warranty through <b>{r.warrantyEnd ?? "—"}</b>
              {r.warrantyMonths ? ` (${r.warrantyMonths} months)` : ""}
            </p>
            {r.installedBy ? <p className="text-slate-500">{r.installedBy}</p> : null}
          </div>
        ))}
      </div>
    </main>
  );
}
