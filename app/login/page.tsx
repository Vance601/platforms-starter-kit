"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";

// Primary sign-in page for battery-city.com.
//
// Unauthenticated visitors are sent here by middleware, so this is the front
// door for every customer. Email + password is the main path (it posts to
// /api/auth-manager, which sets the manager_session cookie scoped to
// .battery-city.com). GitHub is kept as a secondary option for the owner
// account only -- customers should never need a GitHub account.
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callbackUrl, setCallbackUrl] = useState("/");

  // Read ?callbackUrl= from the address bar so people land back where they
  // were headed. Read from window rather than useSearchParams to avoid the
  // Suspense boundary that hook requires during static rendering.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const cb = params.get("callbackUrl");
      // Only accept same-site paths -- never an absolute URL from the query
      // string, which would be an open-redirect.
      if (cb && cb.startsWith("/") && !cb.startsWith("//")) {
        setCallbackUrl(cb);
      }
    } catch {
      // ignore
    }
  }, []);

  async function submit() {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (json?.success) {
        // Full page load so the new cookie is sent with the next request.
        window.location.href = callbackUrl;
      } else {
        setError(json?.error || "Email or password is incorrect.");
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-8 shadow-xl">
        <h1 className="text-center text-2xl font-bold text-white">Battery City</h1>
        <p className="mt-1 text-center text-sm text-slate-400">
          Sign in to your account
        </p>

        <div className="mt-6 space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-xs font-medium uppercase tracking-wide text-slate-400"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder-slate-400"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-xs font-medium uppercase tracking-wide text-slate-400"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="Your password"
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder-slate-400"
            />
          </div>

          {error ? (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <button
            onClick={submit}
            disabled={busy}
            className={
              "w-full rounded-lg px-4 py-3 font-medium " +
              (busy
                ? "cursor-not-allowed bg-slate-600 text-slate-400"
                : "bg-blue-600 text-white hover:bg-blue-500")
            }
          >
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </div>

        {/* Driver path -- drivers use a PIN, not a password. */}
        <p className="mt-6 text-center text-sm text-slate-400">
          Driver?{" "}
          <a href="/driver/login" className="text-blue-400 underline">
            Sign in with your PIN
          </a>
        </p>

        {/* Owner-only fallback. Deliberately understated: customers should
            never think they need a GitHub account to use this. */}
        <div className="mt-6 border-t border-slate-700 pt-4">
          <button
            onClick={() => signIn("github", { callbackUrl })}
            className="w-full text-center text-xs text-slate-500 hover:text-slate-300"
          >
            Owner sign in with GitHub
          </button>
        </div>
      </div>
    </div>
  );
}
