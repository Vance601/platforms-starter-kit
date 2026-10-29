"use client";

import { useState } from "react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!email.trim()) return setError("Enter your email address.");
    setBusy(true);
    try {
      const res = await fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) setMsg(data.message);
      else setError(data.error || "Something went wrong.");
    } catch {
      setError("Something went wrong. Try again.");
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-slate-700 bg-slate-800 p-6">
        <h1 className="text-xl font-semibold text-white">Forgot your password?</h1>
        {msg ? (
          <p className="text-sm text-slate-300">{msg}</p>
        ) : (
          <>
            <p className="text-sm text-slate-400">Enter your email and we&apos;ll send you a link to set a new one.</p>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder-slate-400"
            />
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            <button
              onClick={submit}
              disabled={busy}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white disabled:bg-slate-600"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </>
        )}
        <p className="text-center text-sm">
          <a href="/login" className="text-blue-400 underline">Back to sign in</a>
        </p>
      </div>
    </div>
  );
}
