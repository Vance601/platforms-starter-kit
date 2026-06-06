"use client";

import { useState } from "react";

export default function ManagerSetupPage() {
  const [adminPw, setAdminPw] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function submit() {
    setResult(null);
    if (!adminPw.trim() || !email.trim() || !newPassword.trim()) {
      setResult({ ok: false, msg: "Fill in all three fields." });
      return;
    }
    if (newPassword.trim().length < 8) {
      setResult({ ok: false, msg: "New password must be at least 8 characters." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth-manager/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pw: adminPw.trim(),
          email: email.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setResult({
          ok: true,
          msg: `Password set for ${json.user?.email || email}. They can now log in at /manager/login.`,
        });
        setEmail("");
        setNewPassword("");
      } else {
        setResult({ ok: false, msg: json.error || "Something went wrong." });
      }
    } catch {
      setResult({ ok: false, msg: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-6">
      <h1 className="text-2xl font-bold">Set Manager Password</h1>
      <p className="text-sm text-gray-500">
        Owner access required. The manager must already exist in Settings → User
        Management. This sets (or resets) their login password.
      </p>

      <div className="space-y-1">
        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
          Admin password (owner gate)
        </label>
        <input
          type="password"
          value={adminPw}
          onChange={(e) => setAdminPw(e.target.value)}
          placeholder="Your admin password"
          className="w-full rounded-lg border px-4 py-3"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
          Manager email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="manager@example.com"
          className="w-full rounded-lg border px-4 py-3"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
          New password (8+ characters)
        </label>
        <input
          type="text"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Choose a password for them"
          className="w-full rounded-lg border px-4 py-3"
        />
        <p className="text-xs text-gray-400">
          Shown as plain text so you can copy it to give to the manager.
        </p>
      </div>

      <button
        onClick={submit}
        disabled={busy}
        className={
          "w-full rounded-lg px-4 py-3 font-medium " +
          (busy ? "cursor-not-allowed bg-slate-200 text-slate-400" : "bg-blue-600 text-white")
        }
      >
        {busy ? "Setting…" : "Set Password"}
      </button>

      {result ? (
        <div
          className={
            "rounded-md border p-4 text-sm " +
            (result.ok
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700")
          }
        >
          {result.msg}
        </div>
      ) : null}
    </div>
  );
}
