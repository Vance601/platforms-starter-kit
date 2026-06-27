"use client";

import { useState, useEffect } from "react";

type Driver = {
  id: string;
  name: string;
  active: boolean;
  company: string;
  onShiftTruck: string | null;
};

const COMPANIES = ["phx", "tucson", "abq"];

export default function AdminDrivers() {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Add-driver form
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("phx");

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCompany, setEditCompany] = useState("phx");

  async function loadDrivers() {
    setError("");
    try {
      const res = await fetch(`/api/admin/drivers`);
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to load");
        return false;
      }
      setDrivers(data.drivers);
      return true;
    } catch {
      setError("Network error");
      return false;
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      const ok = await loadDrivers();
      if (ok) setLoaded(true);
      setLoading(false);
    })();
  }, []);

  async function addDriver() {
    if (!newName.trim()) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), company: newCompany }),
      });
      const data = await res.json();
      if (!data.success) setError(data.error || "Failed to add");
      else {
        setNewName("");
        await loadDrivers();
      }
    } catch {
      setError("Network error");
    }
    setBusy(false);
  }

  async function patchDriver(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/drivers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body }),
      });
      const data = await res.json();
      if (!data.success) setError(data.error || "Action failed");
      else await loadDrivers();
    } catch {
      setError("Network error");
    }
    setBusy(false);
  }

  function startEdit(d: Driver) {
    setEditId(d.id);
    setEditName(d.name);
    setEditCompany(d.company);
  }

  async function saveEdit() {
    await patchDriver({
      driverId: editId,
      action: "edit",
      name: editName.trim(),
      company: editCompany,
    });
    setEditId(null);
  }

  // ---------- styles ----------
  const wrap: React.CSSProperties = {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#f8fafc",
    fontFamily: "system-ui, sans-serif",
    padding: "24px 16px",
  };
  const inner: React.CSSProperties = { maxWidth: 760, margin: "0 auto" };
  const input: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#f8fafc",
    fontSize: 14,
  };
  const btn: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  };

  if (!loaded) {
    return (
      <div style={wrap}>
        <div style={{ ...inner, maxWidth: 360 }}>
          <h1 style={{ fontSize: 22, marginBottom: 16 }}>Admin - Drivers</h1>
          {loading ? (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading…</p>
          ) : (
            <>
              {error && (
                <div style={{ color: "#f87171", marginBottom: 12 }}>{error}</div>
              )}
              <button
                onClick={async () => {
                  setLoading(true);
                  const ok = await loadDrivers();
                  if (ok) setLoaded(true);
                  setLoading(false);
                }}
                style={{ ...btn, background: "#22c55e", color: "#0f172a", width: "100%", padding: 12 }}
              >
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={inner}>
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>Drivers</h1>
        {error && (
          <div
            style={{
              background: "#7f1d1d",
              color: "#fecaca",
              padding: 12,
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* Add driver */}
        <div
          style={{
            background: "#1e293b",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New driver name"
            style={{ ...input, flex: 1, minWidth: 180 }}
          />
          <select
            value={newCompany}
            onChange={(e) => setNewCompany(e.target.value)}
            style={input}
          >
            {COMPANIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={addDriver}
            disabled={busy}
            style={{ ...btn, background: "#22c55e", color: "#0f172a" }}
          >
            Add Driver
          </button>
        </div>

        {/* Driver list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {drivers.map((d) => (
            <div
              key={d.id}
              style={{
                background: "#1e293b",
                borderRadius: 12,
                padding: 16,
                opacity: d.active ? 1 : 0.5,
              }}
            >
              {editId === d.id ? (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ ...input, flex: 1, minWidth: 160 }}
                  />
                  <select
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    style={input}
                  >
                    {COMPANIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <button onClick={saveEdit} disabled={busy} style={{ ...btn, background: "#22c55e", color: "#0f172a" }}>
                    Save
                  </button>
                  <button onClick={() => setEditId(null)} style={{ ...btn, background: "#334155", color: "#f8fafc" }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>
                      {d.name}
                      <span style={{ fontSize: 11, color: "#64748b", marginLeft: 8, textTransform: "uppercase" }}>
                        {d.company}
                      </span>
                      {!d.active && (
                        <span style={{ fontSize: 11, color: "#f87171", marginLeft: 8 }}>INACTIVE</span>
                      )}
                    </div>
                    {d.onShiftTruck && (
                      <div style={{ fontSize: 12, color: "#fbbf24", marginTop: 2 }}>
                        On shift - Truck #{d.onShiftTruck}
                      </div>
                    )}
                  </div>
                  <button onClick={() => startEdit(d)} disabled={busy} style={{ ...btn, background: "#334155", color: "#f8fafc" }}>
                    Edit
                  </button>
                  <button
                    onClick={() => patchDriver({ driverId: d.id, action: "resetPin" })}
                    disabled={busy}
                    style={{ ...btn, background: "#334155", color: "#f8fafc" }}
                  >
                    Reset PIN
                  </button>
                  <button
                    onClick={() => patchDriver({ driverId: d.id, action: "toggleActive" })}
                    disabled={busy}
                    style={{ ...btn, background: d.active ? "#7f1d1d" : "#166534", color: "#f8fafc" }}
                  >
                    {d.active ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
