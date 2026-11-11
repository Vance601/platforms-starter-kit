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
  company_id?: string;
};

type OnTruckBattery = {
  id: string;
  barcode: string | null;
  serial_number: string | null;
  model_code?: string | null;
  type_code?: string | null;
  truck_id: string;
  truck_number?: string | null;
  location_id: string | null;
  location_name?: string | null;
  company_id?: string;
};

type LocationOpt = { id: string; name: string; company_id?: string; company_name?: string };

export default function AdminAssignTrucks() {
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  const [selectedBattery, setSelectedBattery] = useState<string | null>(null);
  const [selectedTruck, setSelectedTruck] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  const [tab, setTab] = useState<"assign" | "move">("assign");
  const [onTruck, setOnTruck] = useState<OnTruckBattery[]>([]);
  const [moveTrucks, setMoveTrucks] = useState<Truck[]>([]);
  const [moveLocations, setMoveLocations] = useState<LocationOpt[]>([]);
  const [moveBattery, setMoveBattery] = useState<string | null>(null);
  const [destKind, setDestKind] = useState<"truck" | "location">("location");
  const [toTruckId, setToTruckId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [moving, setMoving] = useState(false);

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
    }

    try {
      const res = await fetch("/api/battery/transfer", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setOnTruck(data.batteries || []);
        setMoveTrucks(data.trucks || []);
        setMoveLocations(data.locations || []);
        if (!toLocationId && data.locations?.length) {
          const prefer =
            data.locations.find((l: LocationOpt) => /elwood/i.test(l.name)) || data.locations[0];
          setToLocationId(prefer.id);
        }
      }
    } catch {
      // assign tab can still work if the move list fails
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

  async function moveBatteryOffTruck() {
    if (!moveBattery) {
      setError("Pick a battery that is on a truck.");
      return;
    }
    if (destKind === "truck" && !toTruckId) {
      setError("Pick the truck to send it to.");
      return;
    }
    if (destKind === "location" && !toLocationId) {
      setError("Pick the warehouse location to return it to.");
      return;
    }
    setMoving(true);
    setError("");
    setFlash(null);
    try {
      const res = await fetch("/api/battery/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batteryId: moveBattery,
          toTruckId: destKind === "truck" ? toTruckId : undefined,
          toLocationId: destKind === "location" ? toLocationId : undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Could not move the battery.");
      } else {
        setFlash(data.message || "Battery moved.");
        setMoveBattery(null);
        await loadData();
      }
    } catch {
      setError("Network error.");
    }
    setMoving(false);
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
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Assign & Transfer</h1>
        <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 16 }}>
          Put a warehouse battery on a truck, move one between trucks, or return one to a warehouse location.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setTab("assign")}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: tab === "assign" ? "2px solid #22c55e" : "1px solid #334155",
              background: tab === "assign" ? "#14532d" : "#1e293b",
              color: "#f8fafc",
              fontWeight: 600,
            }}
          >
            Warehouse → truck
          </button>
          <button
            type="button"
            onClick={() => setTab("move")}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: tab === "move" ? "2px solid #22c55e" : "1px solid #334155",
              background: tab === "move" ? "#14532d" : "#1e293b",
              color: "#f8fafc",
              fontWeight: 600,
            }}
          >
            Off a truck
          </button>
        </div>

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

        {tab === "assign" && (
        <>
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
        </>
        )}

        {tab === "move" && (
        <>
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
            <button
              type="button"
              onClick={() => setDestKind("location")}
              style={{
                ...btn,
                background: destKind === "location" ? "#166534" : "#334155",
                color: "#f8fafc",
              }}
            >
              Back to warehouse
            </button>
            <button
              type="button"
              onClick={() => setDestKind("truck")}
              style={{
                ...btn,
                background: destKind === "truck" ? "#166534" : "#334155",
                color: "#f8fafc",
              }}
            >
              To another truck
            </button>
            {destKind === "location" ? (
              <select
                value={toLocationId}
                onChange={(e) => setToLocationId(e.target.value)}
                style={{ ...input, flex: 1, minWidth: 200 }}
              >
                <option value="">Select a location…</option>
                {moveLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}{l.company_name ? ` · ${l.company_name}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={toTruckId}
                onChange={(e) => setToTruckId(e.target.value)}
                style={{ ...input, flex: 1, minWidth: 200 }}
              >
                <option value="">Select a truck…</option>
                {moveTrucks
                  .filter((t) => t.id !== onTruck.find((b) => b.id === moveBattery)?.truck_id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      Truck #{t.truck_number ?? "—"}
                      {t.driver_name ? ` · ${t.driver_name}` : ""}
                    </option>
                  ))}
              </select>
            )}
            <button
              onClick={moveBatteryOffTruck}
              disabled={moving || !moveBattery || (destKind === "truck" ? !toTruckId : !toLocationId)}
              style={{
                ...btn,
                background: !moveBattery ? "#334155" : "#22c55e",
                color: !moveBattery ? "#94a3b8" : "#0f172a",
                padding: "10px 18px",
              }}
            >
              {moving ? "Moving…" : destKind === "location" ? "Return to warehouse" : "Move to truck"}
            </button>
            <button onClick={() => loadData()} style={{ ...btn, background: "#334155", color: "#f8fafc" }}>
              Refresh
            </button>
          </div>

          {loading ? (
            <div style={{ color: "#94a3b8", padding: 24, textAlign: "center" }}>Loading…</div>
          ) : onTruck.length === 0 ? (
            <div style={{ background: "#1e293b", borderRadius: 12, padding: 32, textAlign: "center", color: "#94a3b8" }}>
              No batteries are on trucks right now.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 13, color: "#94a3b8" }}>
                Tap a battery, pick a destination above, then confirm.
              </p>
              {onTruck.map((b) => {
                const isSelected = b.id === moveBattery;
                return (
                  <button
                    key={b.id}
                    onClick={() => setMoveBattery(isSelected ? null : b.id)}
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
                      {b.barcode ?? b.id}
                      {b.model_code || b.type_code ? ` · ${b.model_code || b.type_code}` : ""}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      On truck #{b.truck_number ?? "—"}
                      {b.location_name ? ` · ${b.location_name}` : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
        )}
      </div>
    </div>
  );
}
