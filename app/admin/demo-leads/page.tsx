"use client";

import { useEffect, useState } from "react";

type Lead = Record<string, string | number | boolean | null>;

const phx = (v: unknown) =>
  v ? new Date(String(v)).toLocaleString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) + " MST" : "-";

export default function DemoLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(search = q) {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/demo-leads?q=${encodeURIComponent(search)}`, { cache: "no-store" });
      const d = await r.json();
      if (!d.success) setErr(d.error || "Could not load leads");
      else { setLeads(d.leads); setErr(""); }
    } catch {
      setErr("Could not load leads");
    }
    setLoading(false);
  }
  useEffect(() => { load(""); }, []);

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Demo Leads</h1>
          <p className="text-sm text-muted-foreground">Everyone who started the demo, newest first. Times are Phoenix time (MST).</p>
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <input className="border rounded px-3 py-2 w-64" placeholder="Search name, email, company, city…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="rounded border px-3 py-2">Search</button>
          <a className="rounded bg-slate-800 text-white px-3 py-2" href={`/api/admin/demo-leads?format=csv&q=${encodeURIComponent(q)}`}>Export CSV</a>
        </form>
      </div>
      {err && <div className="mb-4 text-red-600">{err}</div>}
      {loading ? <div>Loading…</div> : leads.length === 0 ? <div className="text-muted-foreground">No demo leads yet.</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Started</th><th className="pr-3">Name</th><th className="pr-3">Email</th><th className="pr-3">Company</th>
                <th className="pr-3">Phone</th><th className="pr-3">Location</th><th className="pr-3">Device</th><th className="pr-3">Source</th>
                <th className="pr-3">Last seen</th><th className="pr-3 text-right">Visits</th><th className="pr-3 text-right">Actions</th><th className="text-right">Sales</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={String(l.id)} className="border-b align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{phx(l.created_at)}{l.resumed ? <span className="ml-1 text-xs text-muted-foreground">(return)</span> : null}</td>
                  <td className="pr-3">{l.name}</td>
                  <td className="pr-3"><a className="underline" href={`mailto:${l.email}`}>{l.email}</a></td>
                  <td className="pr-3">{l.company || "-"}</td>
                  <td className="pr-3 whitespace-nowrap">{l.phone || "-"}</td>
                  <td className="pr-3">{[l.city, l.region, l.country].filter(Boolean).join(", ") || "-"}</td>
                  <td className="pr-3" title={String(l.user_agent || "")}>{l.device || "-"}</td>
                  <td className="pr-3 max-w-[220px] truncate" title={String(l.referrer || "")}>
                    {[l.utm_source, l.utm_medium, l.utm_campaign].filter(Boolean).join(" / ") || (l.referrer ? String(l.referrer).replace(/^https?:\/\//, "") : "direct")}
                  </td>
                  <td className="pr-3 whitespace-nowrap">{phx(l.last_seen)}</td>
                  <td className="pr-3 text-right">{l.logins}</td>
                  <td className="pr-3 text-right">{l.actions}</td>
                  <td className="text-right">{l.sales}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
