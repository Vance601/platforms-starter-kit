"use client";

import { useEffect, useState } from "react";
import { BarcodeReader } from "@/components/barcode-reader";
import { normalizeScanText, findScannedItem } from "@/lib/scan-code";
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

type WarehouseTruck = { id: string; truck_number: string; current_driver_name: string | null };
type WarehouseBattery = { id: string; barcode: string; serial_number: string | null; status: string; model_code?: string };

function WarehouseTransferView() {
  const [trucks, setTrucks] = useState<WarehouseTruck[]>([]);
  const [batteries, setBatteries] = useState<WarehouseBattery[]>([]);
  const [truckId, setTruckId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/battery/loadable", { cache: "no-store" });
      const data = await res.json();
      if (res.status === 401) {
        window.location.href = "/driver/login";
        return;
      }
      if (!data.success) {
        setError(data.error || "Could not load warehouse stock.");
        return;
      }
      setTrucks(data.trucks || []);
      setBatteries(data.batteries || []);
      setTruckId((prev) => prev || (data.trucks?.[0]?.id ?? ""));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleScan(code: string) {
    const match = findScannedItem(batteries, code);
    if (!match) {
      setHighlightId(null);
      setScanMsg(`${code} is not in the warehouse list. Already on a truck, sold, or a different location.`);
      return;
    }
    setScanMsg(null);
    setHighlightId(match.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(match.id);
      return next;
    });
    setTimeout(() => {
      document.getElementById(`xfer-${match.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleTransfer() {
    if (!truckId || selectedIds.size === 0 || submitting) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    const ids = Array.from(selectedIds);
    let moved = 0;
    const failures: string[] = [];
    for (const batteryId of ids) {
      try {
        const res = await fetch("/api/battery/load", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batteryId, truckId }),
        });
        const data = await res.json();
        if (data.success) moved += 1;
        else {
          const bc = batteries.find((b) => b.id === batteryId)?.barcode || batteryId;
          failures.push(`${bc}: ${data.error || "failed"}`);
        }
      } catch {
        const bc = batteries.find((b) => b.id === batteryId)?.barcode || batteryId;
        failures.push(`${bc}: network error`);
      }
    }
    const truckNo = trucks.find((t) => t.id === truckId)?.truck_number ?? "—";
    if (moved > 0) {
      setSuccess(`${moved} batter${moved === 1 ? "y" : "ies"} transferred onto Truck #${truckNo}. This is a transfer, not a sale.`);
    }
    if (failures.length > 0) setError(`Some didn't transfer — ${failures.join("; ")}`);
    setSelectedIds(new Set());
    await loadData();
    setSubmitting(false);
  }

  const picked = trucks.find((t) => t.id === truckId);
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
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Transfer batteries</h1>
        <p style={{ color: "#94a3b8", marginBottom: 16, fontSize: 14 }}>
          Move batteries from the warehouse onto a truck. This is a transfer, not a sale. You do not need to claim the truck.
        </p>

        {loading ? <div style={{ color: "#94a3b8" }}>Loading…</div> : null}
        {success ? (
          <div style={{ background: "#064e3b", color: "#a7f3d0", padding: 14, borderRadius: 12, marginBottom: 16 }}>
            {success}
          </div>
        ) : null}
        {error ? (
          <div style={{ background: "#7f1d1d", color: "#fecaca", padding: 14, borderRadius: 12, marginBottom: 16 }}>
            {error}
          </div>
        ) : null}

        {!loading ? (
          <>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
              Transfer to truck
              <select
                value={truckId}
                onChange={(e) => setTruckId(e.target.value)}
                style={input}
              >
                {trucks.length === 0 ? <option value="">No trucks found</option> : null}
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>
                    Truck #{t.truck_number}
                    {t.current_driver_name ? ` · held by ${t.current_driver_name}` : " · available"}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ marginBottom: 16 }}>
              <BarcodeReader onScan={handleScan} label="Scan a warehouse battery" />
              {scanMsg ? <p style={{ color: "#fcd34d", fontSize: 13, marginTop: 8 }}>{scanMsg}</p> : null}
            </div>

            <p style={{ fontSize: 14, color: "#cbd5e1", marginBottom: 8 }}>
              Warehouse stock: {batteries.length} batter{batteries.length === 1 ? "y" : "ies"}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {batteries.map((b) => {
                const on = selectedIds.has(b.id);
                return (
                  <button
                    key={b.id}
                    id={`xfer-${b.id}`}
                    type="button"
                    onClick={() => toggleSelect(b.id)}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: on ? "2px solid #22c55e" : "1px solid #334155",
                      background: highlightId === b.id ? "#14532d" : "#1e293b",
                      color: "#f8fafc",
                    }}
                  >
                    <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, wordBreak: "break-all" }}>
                      {b.barcode}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                      {b.model_code || "—"}
                      {on ? " · selected" : ""}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleTransfer}
              disabled={submitting || !truckId || selectedIds.size === 0}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 12,
                border: "none",
                background: submitting || !truckId || selectedIds.size === 0 ? "#334155" : "#22c55e",
                color: submitting || !truckId || selectedIds.size === 0 ? "#94a3b8" : "#0f172a",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {submitting
                ? "Transferring…"
                : !truckId
                ? "Pick a truck first"
                : selectedIds.size === 0
                ? "Select batteries to transfer"
                : `Transfer to Truck #${picked?.truck_number ?? ""}`}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function TransferPage() {
  const [mode, setMode] = useState<"loading" | "warehouse" | "driver">("loading");

  useEffect(() => {
    let alive = true;
    fetch("/api/driver/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d?.success && d.isWarehouse) setMode("warehouse");
        else setMode("driver");
      })
      .catch(() => {
        if (alive) setMode("driver");
      });
    return () => {
      alive = false;
    };
  }, []);

  if (mode === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f8fafc", padding: "24px 16px" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <DriverNav />
          <div style={{ color: "#94a3b8" }}>Loading…</div>
        </div>
      </div>
    );
  }
  if (mode === "warehouse") return <WarehouseTransferView />;

  return <DriverClaimTruckView />;
}

function DriverClaimTruckView() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  // Stock on the truck this driver currently holds (same source as the Sell screen).
  const [stock, setStock] = useState<{ truck: { truck_number: string } | null; batteries: { id: string; barcode: string; model_code?: string | null }[] } | null>(null);
  async function loadStock() {
    try {
      const r = await fetch("/api/battery/sellable", { cache: "no-store" });
      const d = await r.json();
      if (d?.success) setStock({ truck: d.claimedTruck ?? null, batteries: d.batteries ?? [] });
    } catch {
      /* stock panel is informational */
    }
  }

  async function loadTrucks() {
    loadStock();
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
    claim({ truckCode: normalizeScanText(code) });
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

        {stock?.truck && (
          <div
            data-testid="truck-stock"
            style={{ border: "1px solid #334155", background: "#1e293b", borderRadius: 12, padding: 14, marginBottom: 16 }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
              On your truck #{stock.truck.truck_number}: {stock.batteries.length} batter{stock.batteries.length === 1 ? "y" : "ies"}
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>
              To send a battery to another truck or back to the warehouse, open{" "}
              <a href="/driver/move" style={{ color: "#86efac" }}>Move</a>.
            </div>
            {stock.batteries.length === 0 ? (
              <div style={{ fontSize: 13, color: "#94a3b8" }}>No batteries loaded yet. Use Load to add some.</div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13, fontFamily: "ui-monospace, monospace" }}>
                {stock.batteries.map((b) => (
                  <li key={b.id} style={{ padding: "4px 0", borderTop: "1px solid #334155", wordBreak: "break-all" }}>
                    {b.barcode}
                    {b.model_code ? <span style={{ color: "#94a3b8", fontFamily: "system-ui" }}> · {b.model_code}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

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
