"use client";

import { useEffect, useState } from "react";
import { BarcodeReader } from "@/components/barcode-reader";
import DriverNav from "@/components/driver-nav";

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
      const res = await fetch("/api/driver/trucks");
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

  // Set when the server reports the truck is already held. Holds everything
  // needed to repeat the request with confirmTakeover once the driver agrees.
  const [pending, setPending] = useState<{
    truckId?: string;
    truckCode?: string;
    truckNumber: string;
    heldBy: string;
    batteryCount: number;
  } | null>(null);

  // Windshield QR, e.g. "DG-TRUCK-125". Sent as truckCode so the server
  // resolves it inside this driver\'s company.
  function handleScan(code: string) {
    setError("");
    setResult(null);
    claim({ truckCode: code });
  }

  async function claim(args: {
    truckId?: string;
    truckCode?: string;
    confirmTakeover?: boolean;
  }) {
    setClaiming(args.truckId || args.truckCode || "scan");
    try {
      const res = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json();

      if (res.status === 401) {
        window.location.href = "/driver/login";
        return;
      }

      // Already held by someone else - ask before ending their shift.
      if (data.needsConfirmation) {
        setPending({
          truckId: args.truckId,
          truckCode: args.truckCode,
          truckNumber: data.truck?.truck_number || "",
          heldBy: data.heldBy || "another driver",
          batteryCount: data.batteryCount || 0,
        });
        setClaiming(null);
        return;
      }

      if (!data.success) {
        setError(data.error || "Could not claim truck");
        setClaiming(null);
        return;
      }

      setPending(null);
      setResult(data.message);
      await loadTrucks();
    } catch {
      setError("Network error - try again");
    }
    setClaiming(null);
  }

  async function claimTruckOld(truck: Truck) {
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

  function claimTruck(truck: Truck) {
    setError("");
    setResult(null);
    claim({ truckId: truck.id });
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
        <DriverNav />
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Claim a Truck</h1>
        <p style={{ color: "#94a3b8", marginBottom: 20, fontSize: 14 }}>
          Scan the truck&apos;s QR code, or tap it below.
        </p>

        <div style={{ marginBottom: 16 }}>
          <BarcodeReader onScan={handleScan} label="Scan truck QR code" />
        </div>

        {pending && (
          <div
            style={{
              border: "1px solid #f59e0b",
              background: "#78350f22",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
              Truck #{pending.truckNumber} is already out
            </p>
            <p style={{ fontSize: 14, color: "#fcd34d", marginBottom: 4 }}>
              {pending.heldBy} currently has it.
            </p>
            <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 14 }}>
              Taking it ends their shift and moves{" "}
              {pending.batteryCount} batter{pending.batteryCount === 1 ? "y" : "ies"} onto your
              account.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() =>
                  claim({
                    truckId: pending.truckId,
                    truckCode: pending.truckCode,
                    confirmTakeover: true,
                  })
                }
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "#f59e0b",
                  color: "#1c1917",
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                Take Truck #{pending.truckNumber}
              </button>
              <button
                onClick={() => setPending(null)}
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #475569",
                  background: "transparent",
                  color: "#e2e8f0",
                  fontSize: 15,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

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
