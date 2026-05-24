"use client";

import { useState, useEffect, useRef } from "react";

type Load = {
  movement_id: string;
  occurred_at: string;
  battery_id: string;
  truck_id: string | null;
  driver_id: string | null;
  notes: string | null;
  barcode: string | null;
  serial_number: string | null;
  battery_status: string | null;
  group_size: string | null;
  battery_type: string | null;
  truck_number: string | null;
  driver_name: string | null;
};

// The accountability window: a load must be approved within 8 hours of the scan.
const WINDOW_MS = 8 * 60 * 60 * 1000;
// "Getting close" threshold — turns the countdown amber under this much time left.
const WARN_MS = 2 * 60 * 60 * 1000;

export default function AdminLoadApprovals() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loads, setLoads] = useState<Load[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Who is signing off — typed once, applies to every approval this session.
  const [approvedBy, setApprovedBy] = useState("");

  // Per-card approving state + success flashes.
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Ticks every second so the countdowns stay live.
  const [, setTick] = useState(0);
  // Holds the password after a successful login so refreshes can reuse it.
  const pwRef = useRef("");

  async function loadQueue(password: string) {
    setError("");
    try {
      const res = await fetch(
        `/api/battery/pending-loads?pw=${encodeURIComponent(password)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to load.");
        return false;
      }
      setLoads(data.loads || []);
      return true;
    } catch {
      setError("Network error.");
      return false;
    }
  }

  async function handleLogin() {
    setBusy(true);
    const ok = await loadQueue(pw);
    if (ok) {
      pwRef.current = pw;
      setAuthed(true);
    }
    setBusy(false);
  }

  // Live clock for the countdowns.
  useEffect(() => {
    if (!authed) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [authed]);

  // Auto-refresh the queue every 30s so new driver scans appear on their own.
  useEffect(() => {
    if (!authed) return;
    const t = setInterval(() => {
      loadQueue(pwRef.current);
    }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  async function approve(movementId: string) {
    if (!approvedBy.trim()) {
      setError("Enter your name at the top before approving.");
      return;
    }
    setApprovingId(movementId);
    setError("");
    setFlash(null);
    try {
      const res = await fetch("/api/battery/approve-load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pw: pwRef.current,
          movementId,
          approvedBy: approvedBy.trim(),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Could not approve.");
      } else {
        setFlash(data.message || "Load approved.");
        // Drop the approved card immediately; the next refresh confirms.
        setLoads((prev) => prev.filter((l) => l.movement_id !== movementId));
      }
    } catch {
      setError("Network error.");
    }
    setApprovingId(null);
  }

  // ---------- styles (mirrors app/admin/drivers/page.tsx) ----------
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

  // ---------- login gate ----------
  if (!authed) {
    return (
      <div style={wrap}>
        <div style={{ ...inner, maxWidth: 360 }}>
          <h1 style={{ fontSize: 22, marginBottom: 16 }}>Admin — Load Approvals</h1>
          <p style={{ color: "#94a3b8", marginBottom: 12, fontSize: 14 }}>
            Enter the admin password.
          </p>
          {error && (
            <div style={{ color: "#f87171", marginBottom: 12 }}>{error}</div>
          )}
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Admin password"
            style={{ ...input, width: "100%", marginBottom: 12 }}
          />
          <button
            onClick={handleLogin}
            disabled={busy}
            style={{ ...btn, background: "#22c55e", color: "#0f172a", width: "100%", padding: 12 }}
          >
            {busy ? "Checking…" : "Enter"}
          </button>
        </div>
      </div>
    );
  }

  // ---------- countdown helper ----------
  function countdown(occurredAt: string) {
    const scanned = new Date(occurredAt).getTime();
    const deadline = scanned + WINDOW_MS;
    const remaining = deadline - Date.now();

    const overdue = remaining <= 0;
    const abs = Math.abs(remaining);
    const h = Math.floor(abs / 3_600_000);
    const m = Math.floor((abs % 3_600_000) / 60_000);
    const label = overdue
      ? `OVERDUE by ${h}h ${m}m`
      : `${h}h ${m}m left`;

    let color = "#34d399"; // green — plenty of time
    if (overdue) color = "#f87171"; // red — past the 8h window
    else if (remaining <= WARN_MS) color = "#fbbf24"; // amber — under 2h

    return { label, color, overdue };
  }

  // ---------- queue ----------
  return (
    <div style={wrap}>
      <div style={inner}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Load Approvals</h1>
        <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 16 }}>
          Verify each warehouse&nbsp;&rarr;&nbsp;truck load within 8 hours of the scan.
        </p>

        {flash && (
          <div
            style={{
              background: "#166534",
              color: "#dcfce7",
              padding: 12,
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            {flash}
          </div>
        )}
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

        {/* Approved-by name — applies to every approval */}
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
          <label style={{ fontSize: 13, color: "#94a3b8" }}>Approving as</label>
          <input
            value={approvedBy}
            onChange={(e) => setApprovedBy(e.target.value)}
            placeholder="Your name"
            style={{ ...input, flex: 1, minWidth: 180 }}
          />
          <button
            onClick={() => loadQueue(pwRef.current)}
            disabled={busy}
            style={{ ...btn, background: "#334155", color: "#f8fafc" }}
          >
            Refresh
          </button>
        </div>

        {/* Queue */}
        {loads.length === 0 ? (
          <div
            style={{
              background: "#1e293b",
              borderRadius: 12,
              padding: 32,
              textAlign: "center",
              color: "#94a3b8",
            }}
          >
            No loads waiting for approval. Everything on the trucks is signed off.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {loads.map((l) => {
              const cd = countdown(l.occurred_at);
              return (
                <div
                  key={l.movement_id}
                  style={{
                    background: "#1e293b",
                    borderRadius: 12,
                    padding: 16,
                    borderLeft: `4px solid ${cd.color}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>
                        Truck #{l.truck_number ?? "—"}
                        <span
                          style={{
                            fontSize: 12,
                            color: "#64748b",
                            marginLeft: 8,
                            fontWeight: 400,
                          }}
                        >
                          {l.driver_name ?? "Unknown driver"}
                        </span>
                      </div>
                      <div
                        style={{ fontSize: 13, color: "#cbd5e1", marginTop: 4 }}
                      >
                        Group {l.group_size ?? "—"}
                        {l.battery_type ? ` · ${l.battery_type}` : ""}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#64748b",
                          marginTop: 2,
                          fontFamily: "ui-monospace, monospace",
                        }}
                      >
                        {l.barcode ?? l.battery_id}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: cd.color,
                          marginTop: 6,
                          fontWeight: 600,
                        }}
                      >
                        {cd.label}
                      </div>
                    </div>
                    <button
                      onClick={() => approve(l.movement_id)}
                      disabled={approvingId === l.movement_id}
                      style={{
                        ...btn,
                        background: "#22c55e",
                        color: "#0f172a",
                        padding: "10px 18px",
                      }}
                    >
                      {approvingId === l.movement_id ? "Approving…" : "Approve"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
