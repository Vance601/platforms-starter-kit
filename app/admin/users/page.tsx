"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type U = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string | null;
  has_password: boolean;
  must_change_password?: boolean;
};

const ROLES = ["admin", "manager", "driver"];
const input = "border rounded px-2 py-1";

export default function AdminUsers() {
  const [users, setUsers] = useState<U[]>([]);
  const [me, setMe] = useState("");
  const [myRole, setMyRole] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [shown, setShown] = useState<{ who: string; login: string; pw: string } | null>(null);

  // add form
  const [adding, setAdding] = useState(false);
  const [nName, setNName] = useState("");
  const [nLogin, setNLogin] = useState("");
  const [nRole, setNRole] = useState("manager");
  const [nMode, setNMode] = useState<"temp" | "invite">("temp");

  // row editors
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eLogin, setELogin] = useState("");
  const [eRole, setERole] = useState("");
  const [pwId, setPwId] = useState<string | null>(null);
  const [pw, setPw] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) setError(data.error || "Could not load users");
      else {
        setUsers(data.users);
        setMe(data.me);
        setMyRole(data.myRole || "");
        setCanManage(!!data.canManage);
        setError("");
      }
    } catch {
      setError("Could not load users");
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function call(payload: Record<string, unknown>, okText: string, who = "") {
    setNotice(null);
    setShown(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!d.success) setNotice({ ok: false, text: d.error || "That didn't work." });
      else {
        if (d.tempPassword) setShown({ who: d.user?.name || who, login: d.user?.email || "", pw: d.tempPassword });
        setNotice({ ok: true, text: d.note || (d.invited ? `Invite emailed to ${d.user.email}.` : okText) });
        setEditId(null); setPwId(null); setPw(""); setAdding(false);
        setNName(""); setNLogin(""); setNRole("manager"); setNMode("temp");
        await load();
      }
    } catch {
      setNotice({ ok: false, text: "Could not reach the server." });
    }
    setBusy(false);
  }

  const roleOptions = myRole === "owner" ? ["owner", ...ROLES] : ROLES;

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Users &amp; Passwords</h1>
          <p className="text-sm text-muted-foreground">
            People who sign in at /login with an email or username. Drivers who use a PIN are under Admin → Drivers.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/account/password" className="rounded border px-3 py-2 text-sm">Change my password</Link>
          {canManage && (
            <button className="rounded bg-slate-800 text-white px-3 py-2 text-sm" onClick={() => { setAdding(!adding); setNotice(null); }}>
              + Add user
            </button>
          )}
        </div>
      </div>

      {shown && (
        <div className="mb-4 rounded border border-green-600 bg-green-50 p-4 text-green-900">
          <div className="font-semibold">Temporary password for {shown.who}{shown.login ? ` (${shown.login})` : ""}:</div>
          <div className="font-mono text-xl my-2 select-all">{shown.pw}</div>
          <div className="text-sm">Copy it now and give it to them - it won't be shown again. They'll be asked to pick their own password when they sign in.</div>
          <button className="mt-2 text-sm underline" onClick={() => setShown(null)}>Done</button>
        </div>
      )}
      {notice && <div className={`mb-4 rounded border p-3 text-sm ${notice.ok ? "border-green-600 text-green-800" : "border-red-500 text-red-700"}`}>{notice.text}</div>}
      {error && <div className="mb-4 text-red-600">{error}</div>}

      {adding && canManage && (
        <form
          className="mb-6 rounded border p-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); call({ action: "create", name: nName, login: nLogin, role: nRole, mode: nMode }, `Added ${nName}.`, nName); }}
        >
          <label className="text-sm">Full name<input className={`${input} w-full mt-1`} value={nName} onChange={(e) => setNName(e.target.value)} /></label>
          <label className="text-sm">Email or username<input className={`${input} w-full mt-1`} value={nLogin} onChange={(e) => setNLogin(e.target.value)} autoComplete="off" /></label>
          <label className="text-sm">Role
            <select className={`${input} w-full mt-1`} value={nRole} onChange={(e) => setNRole(e.target.value)}>
              {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <fieldset className="text-sm">
            <legend>How they get in</legend>
            <label className="mr-4"><input type="radio" checked={nMode === "temp"} onChange={() => setNMode("temp")} /> Temporary password (shown once)</label>
            <label><input type="radio" checked={nMode === "invite"} onChange={() => setNMode("invite")} /> Email an invite link</label>
          </fieldset>
          <div className="sm:col-span-2 flex gap-2">
            <button disabled={busy} className="rounded bg-slate-800 text-white px-4 py-2 disabled:opacity-50">Add user</button>
            <button type="button" className="px-3 underline" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div>Loading…</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Name</th>
              <th>Email / username</th>
              <th>Role</th>
              <th>Status</th>
              <th>Password</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const locked = u.role === "owner" && myRole !== "owner";
              const self = u.id === me;
              const who = u.name || u.email || "user";
              const inactive = u.status !== "active";
              return (
                <tr key={u.id} className={`border-b align-top ${inactive ? "opacity-60" : ""}`}>
                  {editId === u.id ? (
                    <>
                      <td className="py-2"><input className={`${input} w-40`} value={eName} onChange={(e) => setEName(e.target.value)} /></td>
                      <td><input className={`${input} w-52`} value={eLogin} onChange={(e) => setELogin(e.target.value)} /></td>
                      <td>
                        <select className={input} value={eRole} onChange={(e) => setERole(e.target.value)}>
                          {[...new Set([u.role, ...roleOptions])].map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2">{u.name || "-"}{self && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</td>
                      <td>{u.email || "-"}</td>
                      <td>{u.role}</td>
                    </>
                  )}
                  <td>{u.status}</td>
                  <td>{u.has_password ? (u.must_change_password ? "temporary" : "set") : "none"}</td>
                  {canManage && (
                    <td className="py-2 text-right">
                      {locked ? (
                        <span className="text-muted-foreground">owner only</span>
                      ) : editId === u.id ? (
                        <div className="flex gap-2 justify-end">
                          <button disabled={busy} className="rounded bg-slate-800 text-white px-3 py-1" onClick={() => call({ action: "update", userId: u.id, name: eName, login: eLogin, role: eRole }, `Saved ${eName}.`)}>Save</button>
                          <button className="underline px-1" onClick={() => setEditId(null)}>Cancel</button>
                        </div>
                      ) : pwId === u.id ? (
                        <div className="flex flex-col gap-2 items-end">
                          <input type="text" className={`${input} w-56`} placeholder="New password (8+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
                          <div className="flex gap-2">
                            <button disabled={busy || pw.length < 8} className="rounded bg-slate-800 text-white px-3 py-1 disabled:opacity-50" onClick={() => call({ action: "reset", userId: u.id, newPassword: pw }, `Password updated for ${who}.`)}>Set password</button>
                            <button disabled={busy} className="rounded border px-3 py-1" onClick={() => call({ action: "reset", userId: u.id, generate: true }, `Temporary password made for ${who}.`, who)}>Generate temporary</button>
                            <button className="underline px-1" onClick={() => { setPwId(null); setPw(""); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 justify-end">
                          <button className="rounded border px-2 py-1" onClick={() => { setEditId(u.id); setPwId(null); setEName(u.name || ""); setELogin(u.email || ""); setERole(u.role); setNotice(null); }}>Edit</button>
                          {self ? (
                            <Link href="/account/password" className="rounded border px-2 py-1">Change password</Link>
                          ) : (
                            <button className="rounded border px-2 py-1" onClick={() => { setPwId(u.id); setEditId(null); setPw(""); setNotice(null); }}>Reset password</button>
                          )}
                          {!self && (inactive ? (
                            <button disabled={busy} className="rounded border px-2 py-1" onClick={() => call({ action: "reactivate", userId: u.id }, `${who} can sign in again.`)}>Reactivate</button>
                          ) : (
                            <button disabled={busy} className="rounded border px-2 py-1" onClick={() => call({ action: "deactivate", userId: u.id }, `${who} is deactivated.`)}>Deactivate</button>
                          ))}
                          {!self && (
                            <button disabled={busy} className="rounded border border-red-400 text-red-700 px-2 py-1" onClick={() => { if (confirm(`Remove ${who}? They will no longer be able to sign in.`)) call({ action: "remove", userId: u.id }, `${who} was removed.`); }}>Remove</button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
