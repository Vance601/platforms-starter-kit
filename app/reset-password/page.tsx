"use client";

import { useEffect, useState } from "react";

export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  async function submit() {
    setError("");
    if (pw.length < 8) return setError("Password must be at least 8 characters.");
    if (pw !== pw2) return setError("Passwords don't match.");
    setBusy(true);
    try {
      const res = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: pw }),
      });
      const data = await res.json();
      if (data.success) setDone(true);
      else setError(data.error || "Could not reset password.");
    } catch {
      setError("Something went wrong. Try again.");
    }
    setBusy(false);
  }

  const input = "w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder-slate-400";
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-slate-700 bg-slate-800 p-6">
        <h1 className="text-xl font-semibold text-white">Set a new password</h1>
        {done ? (
          <p className="text-sm text-slate-300">
            Your password has been changed.{" "}
            <a href="/login" className="text-blue-400 underline">Sign in</a>
          </p>
        ) : !token ? (
          <p className="text-sm text-red-300">
            This link is missing its code. <a href="/forgot-password" className="text-blue-400 underline">Request a new link</a>.
          </p>
        ) : (
          <>
            <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (8+ characters)" className={input} />
            <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Confirm new password" className={input} />
            {error ? (
              <p className="text-sm text-red-300">
                {error} {error.includes("Request a new one") ? <a href="/forgot-password" className="text-blue-400 underline">Request one</a> : null}
              </p>
            ) : null}
            <button onClick={submit} disabled={busy} className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white disabled:bg-slate-600">
              {busy ? "Saving…" : "Save new password"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
