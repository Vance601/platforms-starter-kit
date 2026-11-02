"use client";

import { useState } from "react";

// Public landing page for signed-out visitors at "/". Rendered as a full-screen
// layer so the staff sidebar from the app shell is not shown.
export default function Landing() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function tryDemo() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/public/demo", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.success) {
        window.location.href = d.redirect || "/";
        return;
      }
      setErr(d?.error || "The demo is not available right now. Please try again shortly.");
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const btn: React.CSSProperties = { display: "inline-block", padding: "14px 26px", borderRadius: 10, fontSize: 16, fontWeight: 600, textDecoration: "none", border: "none", cursor: "pointer" };
  const features: [string, string][] = [
    ["Scan to sell", "Drivers scan the battery and the VIN at the roadside; the sale, customer and warranty are recorded in one step."],
    ["Every battery tracked", "Warehouse to truck to customer to core return, with barcode labels and a full audit trail."],
    ["Fleet and drivers", "PIN logins for drivers, per-truck stock, transfers and low-stock alerts."],
    ["Warranty lookup", "Customers and staff look up any warranty by VIN or phone in seconds."],
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, overflow: "auto", background: "linear-gradient(180deg,#0f172a,#1e293b)", color: "#f8fafc" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 28px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>🔋 Battery City</div>
        <a href="/login" style={{ color: "#cbd5e1", textDecoration: "none", fontWeight: 600 }}>Log in</a>
      </header>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 28px" }}>
        <h1 style={{ fontSize: 46, lineHeight: 1.1, fontWeight: 800, maxWidth: 760, margin: 0 }}>
          Battery inventory, roadside sales and warranties for towing and roadside fleets.
        </h1>
        <p style={{ fontSize: 19, color: "#cbd5e1", maxWidth: 680, marginTop: 20 }}>
          Know where every battery is, sell from the truck in under a minute, and never lose a core or a warranty again.
        </p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 32 }}>
          <a href="/signup" style={{ ...btn, background: "#22c55e", color: "#0f172a" }}>Sign up</a>
          <button onClick={tryDemo} disabled={busy} style={{ ...btn, background: "#3b82f6", color: "#fff", opacity: busy ? 0.7 : 1 }}>
            {busy ? "Building your demo..." : "Try the demo"}
          </button>
          <a href="/login" style={{ ...btn, background: "transparent", color: "#f8fafc", border: "1px solid #475569" }}>Log in</a>
        </div>
        {err && <p style={{ color: "#fca5a5", marginTop: 14 }}>{err}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 18, marginTop: 64 }}>
          {features.map(([t, d]) => (
            <div key={t} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #334155", borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{t}</div>
              <div style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
