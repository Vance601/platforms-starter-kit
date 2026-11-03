"use client";

import { useEffect, useState } from "react";

export default function ChangePassword() {
  const [first, setFirst] = useState(false);
  const [next, setNext] = useState("/");
  const [hasPw, setHasPw] = useState(true);
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setFirst(q.get("first") === "1");
    const n = q.get("next");
    if (n && n.startsWith("/") && !n.startsWith("//")) setNext(n);
    fetch("/api/account/password", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.user) {
          setHasPw(!!d.user.has_password);
          if (d.user.must_change_password) setFirst(true);
        }
      })
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) return setMsg({ ok: false, text: "New password must be at least 8 characters." });
    if (pw !== pw2) return setMsg({ ok: false, text: "The new passwords don't match." });
    setBusy(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: cur, newPassword: pw }),
      });
      const d = await res.json();
      if (!d.success) setMsg({ ok: false, text: d.error || "Could not change password." });
      else {
        setMsg({ ok: true, text: "Password changed." });
        setCur(""); setPw(""); setPw2("");
        if (first) setTimeout(() => (window.location.href = next), 800);
      }
    } catch {
      setMsg({ ok: false, text: "Could not reach the server." });
    }
    setBusy(false);
  }

  return (
    <div className="p-6 max-w-md">
      <h1 className="text-2xl font-bold mb-1">{first ? "Set a new password" : "Change my password"}</h1>
      <p className="text-sm text-muted-foreground mb-4">
        {first
          ? "You signed in with a temporary password. Choose your own password to continue."
          : "Enter your current password, then your new one."}
      </p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {hasPw && (
          <label className="text-sm">
            {first ? "Temporary password" : "Current password"}
            <input type="password" className="mt-1 w-full border rounded px-3 py-2" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
          </label>
        )}
        <label className="text-sm">
          New password (8+ characters)
          <input type="password" className="mt-1 w-full border rounded px-3 py-2" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </label>
        <label className="text-sm">
          Confirm new password
          <input type="password" className="mt-1 w-full border rounded px-3 py-2" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        </label>
        <button disabled={busy} className="rounded bg-slate-800 text-white px-4 py-2 disabled:opacity-50">
          {busy ? "Saving…" : "Change password"}
        </button>
        {msg && <div className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</div>}
      </form>
    </div>
  );
}
