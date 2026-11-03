"use client";

import { useState } from "react";
import DriverNav from "@/components/driver-nav";

export default function ChangePinPage() {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPin !== confirmPin) { setMsg({ ok: false, text: "New PINs don't match" }); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/auth-driver/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      if (r.status === 401 && !(await r.clone().json().catch(() => ({})))?.error?.includes("Current")) {
        window.location.href = "/driver/login";
        return;
      }
      const d = await r.json().catch(() => ({}));
      if (d?.success) {
        setMsg({ ok: true, text: "PIN changed. Use your new PIN next time you log in." });
        setCurrentPin(""); setNewPin(""); setConfirmPin("");
      } else setMsg({ ok: false, text: d?.error || "Could not change PIN" });
    } catch {
      setMsg({ ok: false, text: "Network error - try again" });
    }
    setBusy(false);
  }

  const input: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #334155",
    background: "#1e293b", color: "#f8fafc", fontSize: 18, letterSpacing: 4, marginTop: 4, boxSizing: "border-box",
  };
  const field = (label: string, v: string, set: (s: string) => void, name: string) => (
    <label style={{ display: "block", marginBottom: 14, fontSize: 14, color: "#cbd5e1" }}>
      {label}
      <input name={name} type="password" inputMode="numeric" autoComplete="off" maxLength={4} pattern="\d{4}" required
        value={v} onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 4))} style={input} />
    </label>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f8fafc", fontFamily: "system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <DriverNav />
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>Change PIN</h1>
        <form onSubmit={submit}>
          {field("Current PIN", currentPin, setCurrentPin, "currentPin")}
          {field("New PIN (4 digits)", newPin, setNewPin, "newPin")}
          {field("Confirm new PIN", confirmPin, setConfirmPin, "confirmPin")}
          {msg && (
            <div style={{ background: msg.ok ? "#064e3b" : "#7f1d1d", color: msg.ok ? "#a7f3d0" : "#fecaca", padding: 12, borderRadius: 10, marginBottom: 14 }}>
              {msg.text}
            </div>
          )}
          <button type="submit" disabled={busy}
            style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "#22c55e", color: "#0f172a", fontSize: 16, fontWeight: 700 }}>
            {busy ? "Saving…" : "Change PIN"}
          </button>
        </form>
      </div>
    </div>
  );
}
