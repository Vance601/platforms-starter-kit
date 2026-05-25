"use client";

import { useState, useEffect, useRef } from "react";

type Battery = {
  id: string;
  barcode: string | null;
  serial_number: string | null;
  group_size: string | null;
  battery_type: string | null;
};

type Truck = {
  id: string;
  truck_number: string | null;
  year_model: string | null;
  driver_name: string | null;
};

export default function AdminAssignTrucks() {
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  const [selectedBattery, setSelectedBattery] = useState<string | null>(null);
  const [selectedTruck, setSelectedTruck] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  const didInit = useRef(false);

  async function loadData() {
    setError("");
    try {
      const res = await fetch("/api/battery/assign-truck", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to load.");
        return;
      }
      setBatteries(data.batteries || []);
      setTrucks(data.trucks || []);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    loadData();
  }, []);

  async function assign() {
    if (!selectedBattery || !selectedTruck) {
      setError("Pick a battery and a truck.");
      return;
    }
    setAssigning(true);
    setError("");
    setFlash(null);
    try {
      const res = await fetch("/api/battery/assign-truck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batteryId: selectedBattery, truckId: selectedTruck }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Could not assign.");
      } else {
        setFlash(data.message || "Battery assigned.");
        setBatteries((prev) => prev.filter((b) => b.id !== selectedBattery));
        setSelectedBattery(null);
      }
    } catch {
      setError("Network error.");
    }
    setAssigning(false);
  }

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

  return (
    <div style={wrap}>
      <div style={inner}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Assign to Trucks</h1>
        <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 16 }}>
          Add a warehouse battery to a truck. Admin assignments are auto-approved.
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
          <label style={{ fontSize: 13, color: "#94a3b8" }}>Assign to</label>
          <select
            value={selectedTruck}
            onChange={(e) => setSelectedTruck(e.target.value)}
            style={{ ...input, flex: 1, minWidth: 200 }}
          >
            <option value="">Select a truck…</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                Truck #{t.truck_number ?? "—"}
                {t.driver_name ? ` · ${t.driver_name}` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={assign}
            disabled={assigning || !selectedBattery || !selectedTruck}
            style={{
              ...btn,
              background: !selectedBattery || !selectedTruck ? "#334155" : "#22c55e",
              color: !selectedBattery || !selectedTruck ? "#94a3b8" : "#0f172a",
              padding: "10px 18px",
            }}
          >
            {assigning ? "Assigning…" : "Assign"}
          </button>
          <button
            onClick={() => loadData()}
            style={{ ...btn, background: "#334155", color: "#f8fafc" }}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ color: "#94a3b8", padding: 24, textAlign: "center" }}>Loading…</div>
        ) : batteries.length === 0 ? (
          <div style={{ background: "#1e293b", borderRadius: 12, padding: 32, textAlign: "center", color: "#94a3b8" }}>
            No batteries in the warehouse to assign.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 13, color: "#94a3b8" }}>
              Tap a battery to select it, pick a truck above, then Assign.
            </p>
            {batteries.map((b) => {
              const isSelected = b.id === selectedBattery;
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBattery(isSelected ? null : b.id)}
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    background: "#1e293b",
                    borderRadius: 12,
                    padding: 16,
                    border: isSelected ? "2px solid #3b82f6" : "2px solid transparent",
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 600 }}>
                    Group {b.group_size ?? "—"}
                    {b.battery_type ? ` · ${b.battery_type}` : ""}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      marginTop: 2,
                      fontFamily: "ui-monospace, monospace",
                    }}
                  >
                    {b.barcode ?? b.id}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
