"use client";
import { useState } from "react";

// Lead form shown before a demo starts. Posts to /api/public/demo with the
// visitor's details, page referrer and UTM params, then follows the redirect.
export default function DemoLeadForm({ onClose, dark = true }: { onClose: () => void; dark?: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (name.trim().length < 2) return setErr("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim())) return setErr("Please enter a valid email address.");
    setBusy(true);
    try {
      const q = new URLSearchParams(window.location.search);
      const utm = Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].map((k) => [k, q.get(k) || sessionStorage.getItem(k) || ""]));
      const r = await fetch("/api/public/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, phone, website, referrer: document.referrer || sessionStorage.getItem("bc_ref") || "", utm }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.success) {
        const chk = await fetch("/api/demo/info", { cache: "no-store" }).catch(() => null);
        if (!chk || !chk.ok) { setErr("The demo started, but your browser didn't keep the sign-in. Please open https://www.battery-city.com and try again."); setBusy(false); return; }
        window.location.href = d.redirect || "/";
        return;
      }
      setErr(d?.error || "The demo is not available right now. Please try again shortly.");
    } catch {
      setErr("Network error. Please try again.");
    }
    setBusy(false);
  }

  const field = dark
    ? "mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
    : "mt-1 w-full rounded-lg border px-3 py-2";
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="demo-form-title" className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 text-slate-100 shadow-2xl">
        <h2 id="demo-form-title" className="text-xl font-bold">Try the Battery City demo</h2>
        <p className="mt-1 mb-4 text-sm text-slate-300">Tell us who you are and we'll build you a private demo company with sample data. It's free and takes a few seconds.</p>
        <label className="block text-sm mb-3">Name *<input className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required autoFocus /></label>
        <label className="block text-sm mb-3">Email *<input type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block text-sm">Company <span className="text-slate-400">(optional)</span><input className={field} value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" /></label>
          <label className="block text-sm">Phone <span className="text-slate-400">(optional)</span><input type="tel" className={field} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></label>
        </div>
        {/* Honeypot: hidden from people, bots fill it. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
          <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" /></label>
        </div>
        {err && <p className="mb-3 text-sm text-red-400">{err}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-blue-500 px-4 py-3 font-semibold text-white hover:bg-blue-600 disabled:opacity-50">{busy ? "Building your demo..." : "Start the demo"}</button>
          <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-600 px-4 py-3 text-slate-200">Cancel</button>
        </div>
        <p className="mt-3 text-xs text-slate-400">We'll only use this to follow up about Battery City.</p>
      </form>
    </div>
  );
}
