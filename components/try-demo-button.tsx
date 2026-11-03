"use client";
import { useState } from "react";

// Same target as the landing page: POST /api/public/demo, then follow redirect.
export default function TryDemoButton({ className = "" }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function start() {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/public/demo", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.success) {
        const chk = await fetch("/api/demo/info", { cache: "no-store" }).catch(() => null);
        if (!chk || !chk.ok) { setErr("The demo started, but your browser didn't keep the sign-in. Please open https://www.battery-city.com and try again."); return; }
        window.location.href = d.redirect || "/"; return;
      }
      setErr(d?.error || "The demo is not available right now. Please try again shortly.");
    } catch { setErr("Network error. Please try again."); }
    finally { setBusy(false); }
  }
  return (
    <div className={className}>
      <button type="button" onClick={start} disabled={busy}
        className="w-full rounded-lg border border-blue-500 px-4 py-3 font-medium text-blue-300 hover:bg-blue-500/10 disabled:opacity-50">
        {busy ? "Starting demo…" : "Try the demo"}
      </button>
      {err ? <p className="mt-2 text-center text-sm text-red-400">{err}</p> : null}
    </div>
  );
}
