"use client";

import { useEffect, useState } from "react";

type U = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string | null;
  has_password: boolean;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<U[]>([]);
  const [myRole, setMyRole] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [shown, setShown] = useState<{ who: string; pw: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) setError(data.error || "Could not load users");
      else {
        setUsers(data.users);
        setMyRole(data.myRole);
        setError("");
      }
    } catch {
      setError("Could not load users");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function reset(u: U, generate: boolean) {
    setNotice("");
    setShown(null);
    if (!generate && pw.length < 8) {
      setNotice("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generate ? { userId: u.id, generate: true } : { userId: u.id, newPassword: pw }),
      });
      const data = await res.json();
      const who = u.name || u.email || "user";
      if (!data.success) setNotice(data.error || "Reset failed");
      else if (data.tempPassword) setShown({ who, pw: data.tempPassword });
      else setNotice(`Password updated for ${who}.`);
      if (data.success) {
        setPw("");
        setOpenId(null);
        load();
      }
    } catch {
      setNotice("Reset failed");
    }
    setBusy(false);
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Users &amp; Passwords</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Reset the email/password login for someone in your organization. They sign in at /login.
      </p>
      {shown && (
        <div className="mb-4 rounded border border-green-600 bg-green-50 p-4 text-green-900">
          <div className="font-semibold">Temporary password for {shown.who}:</div>
          <div className="font-mono text-xl my-2 select-all">{shown.pw}</div>
          <div className="text-sm">Copy it now and give it to them - it will not be shown again.</div>
          <button className="mt-2 text-sm underline" onClick={() => setShown(null)}>Done</button>
        </div>
      )}
      {notice && <div className="mb-4 rounded border p-3 text-sm">{notice}</div>}
      {error && <div className="mb-4 text-red-600">{error}</div>}
      {loading ? (
        <div>Loading…</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Password</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const locked = u.role === "owner" && myRole !== "owner";
              return (
                <tr key={u.id} className="border-b align-top">
                  <td className="py-2">{u.name || "-"}</td>
                  <td>{u.email || "-"}</td>
                  <td>{u.role}</td>
                  <td>{u.has_password ? "set" : "none"}</td>
                  <td className="py-2 text-right">
                    {locked ? (
                      <span className="text-muted-foreground">owner only</span>
                    ) : openId === u.id ? (
                      <div className="flex flex-col gap-2 items-end">
                        <input
                          type="text"
                          className="border rounded px-2 py-1 w-56"
                          placeholder="New password (8+ characters)"
                          value={pw}
                          onChange={(e) => setPw(e.target.value)}
                          autoComplete="new-password"
                        />
                        <div className="flex gap-2">
                          <button disabled={busy} className="rounded bg-slate-800 text-white px-3 py-1" onClick={() => reset(u, false)}>
                            Set password
                          </button>
                          <button disabled={busy} className="rounded border px-3 py-1" onClick={() => reset(u, true)}>
                            Generate temporary
                          </button>
                          <button className="px-2 py-1 underline" onClick={() => { setOpenId(null); setPw(""); }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button className="rounded border px-3 py-1" onClick={() => { setOpenId(u.id); setPw(""); setNotice(""); }}>
                        Reset password
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
