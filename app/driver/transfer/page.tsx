"use client";

import { useEffect, useState } from "react";

type Truck = {
  id: string;
  truck_number: string;
  year_model: string | null;
  vin_last5: string | null;
  current_driver_id: string | null;
  current_driver_name: string | null;
  company: string;
};

export default function TransferPage() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function loadTrucks() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/trucks");
      const data = await res.json();
      if (data.success) {
        setTrucks(data.trucks);
      } else {
        setError(data.error || "Could not load trucks");
      }
    } catch {
      setError("Could not load trucks");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadTrucks();
  }, []);

  async function claimTruck(truck: Truck) {
    setClaiming(truck.id);
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ truckId: truck.id }),
      });
      const data = await res.json();
      if (res.status === 401) {
        window.location.href = "/driver/login";
        return;
      }
      if (!data.success) {
        setError(data.error || "Could not claim truck");
        setClaiming(null);
        return;
      }
      setResult(data.message);
      await loadTrucks();
    } catch {
      setError("Network error — try again");
    }
    setClaiming(null);
  }

  const wrap: React.CSSProperties = {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#f8fafc",
    fontFamily: "system-ui, sans-serif",
    padding: "24px 16px",
  };
  const inner: React.CSSProperties = { maxWidth: 480, margin: "0 auto" };

  return (
    <div style={wrap}>
      <div style={inner}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Claim a Truck</h1>
        <p style={{ color: "#94a3b8", marginBottom: 20, fontSize: 14 }}>
          Tap the truck you&apos;re taking out.
        </p>

        {result && (
          <div
            style={{
              background: "#064e3b",
              color: "#a7f3d0",
              padding: 14,
              borderRadius: 12,
              marginBottom: 16,
              fontSize: 15,
            }}
          >
            {result}
          </div>
        )}
        {error && (
          <div
            style={{
              background: "#7f1d1d",
              color: "#fecaca",
              padding: 14,
              borderRadius: 12,
              marginBottom: 16,
              fontSize: 15,
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ color: "#94a3b8" }}>Loading trucks…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {trucks.map((t) => {
              const held = !!t.current_driver_id;
              return (
                <button
                  key={t.id}
                  onClick={() => claimTruck(t)}
                  disabled={claiming !== null}
                  style={{
                    textAlign: "left",
                    padding: "16px 18px",
                    borderRadius: 12,
                    border: "1px solid #334155",
                    background: "#1e293b",
                    color: "#f8fafc",
                    cursor: claiming !== null ? "default" : "pointer",
                    opacity: claiming !== null && claiming !== t.id ? 0.5 : 1,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 600 }}>
                    Truck #{t.truck_number}
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 400,
                        color: "#64748b",
                        marginLeft: 8,
                        textTransform: "uppercase",
                      }}
                    >
                      {t.company}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>
                    {t.year_model ?? "—"}
                    {t.vin_last5 ? ` · VIN …${t.vin_last5}` : ""}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: held ? "#fbbf24" : "#34d399",
                      marginTop: 4,
                    }}
                  >
                    {held
                      ? `Currently held by ${t.current_driver_name ?? "another driver"}`
                      : "Available"}
                    {claiming === t.id ? " — claiming…" : ""}
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
