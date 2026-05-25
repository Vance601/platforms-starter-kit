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

const WINDOW_MS = 8 * 60 * 60 * 1000;
const WARN_MS = 2 * 60 * 60 * 1000;

export default function AdminLoadApprovals() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const didInit = useRef(false);

  async function loadQueue() {
    setError("");
    try {
      const res = await fetch("/api/battery/pending-loads", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to load.");
        return;
      }
      setLoads(data.loads || []);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    loadQueue();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => loadQueue(), 30000);
    return () => clearInterval(t);
  }, []);

  async function approve(movementId: string) {
    setApprovingId(movementId);
    setError("");
    setFlash(null);
    try {
      const res = await fetch("/api/battery/approve-load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movementId }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Could not approve.");
      } else {
        setFlash(data.message || "Load approved.");
        setLoads((prev) => prev.filter((l) => l.movement_id !== movementId));
      }
    } catch {
      setError("Network error.");
    }
    setApprovingId(null);
  }

  const wrap: React.CSSProperties = {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#f8fafc",
    fontFamily: "system-ui, sans-serif",
    padding: "24px 16px",
  };
  const inner: React.CSSProperties = { maxWidth: 760, margin: "0 auto" };
  const btn: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  };

  function countdown(occurredAt: string) {
    const scanned = new Date(occurredAt).getTime();
    const deadline = scanned + WINDOW_MS;
    const remaining = deadline - Date.now();
    const overdue = remaining <= 0;
    const abs = Math.abs(remaining);
    const h = Math.floor(abs / 3_600_000);
    const m = Math.floor((abs % 3_600_000) / 60_000);
    const label = overdue ? `OVERDUE by ${h}h ${m}m` : `${h}h ${m}m left`;
    let color = "#34d399";
    if (overdue) color = "#f87171";
    else if (remaining <= WARN_MS) color = "#fbbf24";
    return { label, color, overdue };
  }

  return (
    <div style={wrap}>
      <div style={inner}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Load Approvals</h1>
        <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 16 }}>
          Verify each warehouse&nbsp;&rarr;&nbsp;truck load within 8 hours of the scan.
        </p>

        {flash && (
          <div style={{ background: "#166534", color: "#dcfce7", padding: 12, borderRadius: 10, marginBottom: 16 }}>
            {flash}
          </div>
        )}
        {error && (
          <div style={{ background: "#7f1d1d", color: "#fecaca", padding: 12, borderRadius: 10, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <button onClick={() => loadQueue()} style={{ ...btn, background: "#334155", color: "#f8fafc" }}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ color: "#94a3b8", padding: 24, textAlign: "center" }}>Loading…</div>
        ) : loads.length === 0 ? (
          <div style={{ background: "#1e293b", borderRadius: 12, padding: 32, textAlign: "center", color: "#94a3b8" }}>
            No loads waiting for approval. Everything on the trucks is signed off.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {loads.map((l) => {
              const cd = countdown(l.occurred_at);
              return (
                <div
                  key={l.movement_id}
                  style={{ background: "#1e293b", borderRadius: 12, padding: 16, borderLeft: `4px solid ${cd.color}` }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>
                        Truck #{l.truck_number ?? "—"}
                        <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8, fontWeight: 400 }}>
                          {l.driver_name ?? "Unknown driver"}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 4 }}>
                        Group {l.group_size ?? "—"}
                        {l.battery_type ? ` · ${l.battery_type}` : ""}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, fontFamily: "ui-monospace, monospace" }}>
                        {l.barcode ?? l.battery_id}
                      </div>
                      <div style={{ fontSize: 13, color: cd.color, marginTop: 6, fontWeight: 600 }}>
                        {cd.label}
                      </div>
                    </div>
                    <button
                      onClick={() => approve(l.movement_id)}
                      disabled={approvingId === l.movement_id}
                      style={{ ...btn, background: "#22c55e", color: "#0f172a", padding: "10px 18px" }}
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
