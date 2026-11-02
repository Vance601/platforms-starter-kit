"use client";

import { useEffect, useState } from "react";
import { US_TIMEZONES } from "@/lib/us-timezones";

export default function SignupPage() {
  const [f, setF] = useState({
    name: "", email: "", password: "", orgName: "", locationName: "Main Warehouse",
    city: "", state: "", timezone: "America/Chicago", barcodePrefix: "BC", coreCharge: "25",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("error");
    if (e) setError(e);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (US_TIMEZONES.some((z) => z.value === tz)) setF((p) => ({ ...p, timezone: tz }));
    } catch {}
  }, []);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: k === "barcodePrefix" ? e.target.value.toUpperCase() : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/public/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, coreCharge: Number(f.coreCharge) }),
      });
      const d = await r.json().catch(() => ({}));
      if (d?.success) setDone(d.message);
      else setError(d?.error || "Could not sign up.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 };
  const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, marginBottom: 14, boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f6f7f9", padding: 24 }}>
      <div style={{ background: "#fff", padding: 36, borderRadius: 14, maxWidth: 520, width: "100%", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Create your Battery City account</h1>
        <p style={{ color: "#666", fontSize: 14, marginBottom: 22 }}>
          Track batteries, trucks, drivers, sales and warranties. Already have an account? <a href="/login" style={{ color: "#2563eb" }}>Log in</a>
        </p>
        {done ? (
          <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: 16, borderRadius: 8, fontSize: 15 }}>{done}</div>
        ) : (
          <form onSubmit={submit}>
            {error && <div style={{ background: "#fdecec", border: "1px solid #f5c2c2", color: "#a12", padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 16 }}>{error}</div>}
            <label style={label}>Your name</label>
            <input style={input} value={f.name} onChange={set("name")} required autoComplete="name" />
            <label style={label}>Work email</label>
            <input style={input} type="email" value={f.email} onChange={set("email")} required autoComplete="email" />
            <label style={label}>Password (8+ characters)</label>
            <input style={input} type="password" value={f.password} onChange={set("password")} required minLength={8} autoComplete="new-password" />
            <label style={label}>Company name</label>
            <input style={input} value={f.orgName} onChange={set("orgName")} required placeholder="e.g. Acme Towing" />
            <label style={label}>First location</label>
            <input style={input} value={f.locationName} onChange={set("locationName")} required />
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}><label style={label}>City</label><input style={input} value={f.city} onChange={set("city")} /></div>
              <div style={{ width: 100 }}><label style={label}>State</label><input style={input} value={f.state} onChange={set("state")} maxLength={2} /></div>
            </div>
            <label style={label}>Business timezone</label>
            <select style={input} value={f.timezone} onChange={set("timezone")}>
              {US_TIMEZONES.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
            </select>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}><label style={label}>Barcode prefix</label><input style={input} value={f.barcodePrefix} onChange={set("barcodePrefix")} maxLength={6} /></div>
              <div style={{ flex: 1 }}><label style={label}>Core charge ($)</label><input style={input} type="number" min="0" step="0.01" value={f.coreCharge} onChange={set("coreCharge")} /></div>
            </div>
            <button type="submit" disabled={busy} style={{ width: "100%", padding: "12px 24px", borderRadius: 8, border: "none", background: busy ? "#9db4d8" : "#2563eb", color: "#fff", fontSize: 16, fontWeight: 600, cursor: busy ? "default" : "pointer", marginTop: 6 }}>
              {busy ? "Sending..." : "Create account"}
            </button>
            <p style={{ color: "#888", fontSize: 12, marginTop: 12 }}>We'll email you a link to confirm your address before your account is created.</p>
          </form>
        )}
      </div>
    </div>
  );
}
