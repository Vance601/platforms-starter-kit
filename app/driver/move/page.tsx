"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DriverNav from "@/components/driver-nav";
import { BarcodeReader } from "@/components/barcode-reader";

type Battery = {
  id: string;
  barcode: string;
  serial_number: string | null;
  model_code?: string | null;
  truck_id: string;
  truck_number?: string;
  location_id: string | null;
  location_name?: string | null;
};
type Truck = { id: string; truck_number: string; driver_name: string | null };
type Loc = { id: string; name: string };

export default function DriverMovePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [claimed, setClaimed] = useState<{ id: string; truck_number: string } | null>(null);
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [locations, setLocations] = useState<Loc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [destKind, setDestKind] = useState<"truck" | "location">("location");
  const [toTruckId, setToTruckId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/battery/transfer", { cache: "no-store" });
      const data = await res.json();
      if (res.status === 401) {
        router.push("/driver/login");
        return;
      }
      if (!data.success) {
        setError(data.error || "Could not load batteries.");
        // Keep any already-known claim. A load failure is not the same as
        // "you have no truck."
        if (data.trucks) setTrucks(data.trucks);
        if (data.locations) setLocations(data.locations);
        return;
      }
      setClaimed(data.claimedTruck || null);
      setBatteries(data.batteries || []);
      setTrucks(data.trucks || []);
      setLocations(data.locations || []);
      if (!toLocationId && data.locations?.length) {
        const prefer =
          data.locations.find((l: Loc) => /elwood/i.test(l.name)) || data.locations[0];
        setToLocationId(prefer.id);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleScan(code: string) {
    const needle = code.trim().toLowerCase();
    const match = batteries.find(
      (b) =>
        b.barcode?.trim().toLowerCase() === needle ||
        b.serial_number?.trim().toLowerCase() === needle,
    );
    if (!match) {
      setScanMsg(`${code} is not on your truck.`);
      return;
    }
    setScanMsg(null);
    setSelectedId(match.id);
    setTimeout(() => {
      document.getElementById(`move-${match.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  async function submit() {
    if (!selectedId) {
      setError("Pick a battery on your truck.");
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
    setBusy(true);
    setError("");
    setFlash("");
    try {
      const res = await fetch("/api/battery/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batteryId: selectedId,
          toTruckId: destKind === "truck" ? toTruckId : undefined,
          toLocationId: destKind === "location" ? toLocationId : undefined,
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        router.push("/driver/login");
        return;
      }
      if (!data.success) {
        setError(data.error || "Could not move the battery.");
      } else {
        setFlash(data.message || "Battery moved.");
        setSelectedId(null);
        await loadData();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const otherTrucks = trucks.filter((t) => t.id !== claimed?.id);
  const wrap: React.CSSProperties = {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#f8fafc",
    fontFamily: "system-ui, sans-serif",
    padding: "24px 16px",
  };
  const inner: React.CSSProperties = { maxWidth: 480, margin: "0 auto" };
  const input: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#f8fafc",
    fontSize: 14,
    marginTop: 4,
  };

  return (
    <div style={wrap}>
      <div style={inner}>
        <DriverNav />
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Move a battery</h1>
        <p style={{ color: "#94a3b8", marginBottom: 16, fontSize: 14 }}>
          Take a battery off your truck and send it to another truck, or return it to the warehouse.
        </p>

        {!loading && !error && !claimed ? (
          <div style={{ background: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 16, color: "#fcd34d" }}>
            Claim a truck first (Truck tab), then come back here to move stock.
          </div>
        ) : null}

        {claimed ? (
          <p style={{ fontSize: 14, color: "#cbd5e1", marginBottom: 12 }}>
            On truck #{claimed.truck_number}: {batteries.length} batter{batteries.length === 1 ? "y" : "ies"}
          </p>
        ) : null}

        {flash ? (
          <div style={{ background: "#064e3b", color: "#a7f3d0", padding: 14, borderRadius: 12, marginBottom: 16 }}>
            {flash}
          </div>
        ) : null}
        {error ? (
          <div style={{ background: "#7f1d1d", color: "#fecaca", padding: 14, borderRadius: 12, marginBottom: 16 }}>
            {error}
          </div>
        ) : null}

        {claimed ? (
          <div style={{ marginBottom: 16 }}>
            <BarcodeReader onScan={handleScan} label="Scan a battery on your truck" />
            {scanMsg ? <p style={{ color: "#fca5a5", fontSize: 13, marginTop: 8 }}>{scanMsg}</p> : null}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setDestKind("location")}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: destKind === "location" ? "2px solid #22c55e" : "1px solid #334155",
              background: destKind === "location" ? "#14532d" : "#1e293b",
              color: "#f8fafc",
              fontWeight: 600,
            }}
          >
            Back to warehouse
          </button>
          <button
            type="button"
            onClick={() => setDestKind("truck")}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: destKind === "truck" ? "2px solid #22c55e" : "1px solid #334155",
              background: destKind === "truck" ? "#14532d" : "#1e293b",
              color: "#f8fafc",
              fontWeight: 600,
            }}
          >
            To another truck
          </button>
        </div>

        {destKind === "location" ? (
          <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
            Warehouse location
            <select value={toLocationId} onChange={(e) => setToLocationId(e.target.value)} style={input}>
              <option value="">Select a location…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
            Destination truck
            <select value={toTruckId} onChange={(e) => setToTruckId(e.target.value)} style={input}>
              <option value="">Select a truck…</option>
              {otherTrucks.map((t) => (
                <option key={t.id} value={t.id}>
                  Truck #{t.truck_number}
                  {t.driver_name ? ` · ${t.driver_name}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={busy || !selectedId || (destKind === "truck" ? !toTruckId : !toLocationId)}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: "none",
            background: selectedId ? "#22c55e" : "#334155",
            color: selectedId ? "#0f172a" : "#94a3b8",
            fontWeight: 700,
            fontSize: 15,
            marginBottom: 16,
            cursor: selectedId && !busy ? "pointer" : "default",
          }}
        >
          {busy ? "Moving…" : destKind === "location" ? "Return to warehouse" : "Move to truck"}
        </button>

        {loading ? <div style={{ color: "#94a3b8" }}>Loading…</div> : null}
        {!loading && claimed && batteries.length === 0 ? (
          <div style={{ color: "#94a3b8", background: "#1e293b", borderRadius: 12, padding: 16 }}>
            No batteries on this truck to move.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {batteries.map((b) => {
              const selected = b.id === selectedId;
              return (
                <button
                  key={b.id}
                  id={`move-${b.id}`}
                  type="button"
                  onClick={() => setSelectedId(selected ? null : b.id)}
                  style={{
                    textAlign: "left",
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: selected ? "2px solid #22c55e" : "1px solid #334155",
                    background: "#1e293b",
                    color: "#f8fafc",
                  }}
                >
                  <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>{b.barcode}</div>
                  <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>
                    {b.model_code || "Battery"}
                    {b.location_name ? ` · from ${b.location_name}` : ""}
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
