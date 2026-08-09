"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DriverNav from "@/components/driver-nav";
import { BarcodeReader } from "@/components/barcode-reader";

type Battery = {
  id: string;
  barcode: string;
  serial_number: string | null;
  status: string;
};

type ClaimedTruck = {
  id: string;
  truck_number: string;
} | null;

type LoadableResponse = {
  success: boolean;
  error?: string;
  driver?: { id: string; name: string; company_id: string };
  claimedTruck?: ClaimedTruck;
  batteries?: Battery[];
};

export default function DriverLoadPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driverName, setDriverName] = useState<string>("");
  const [claimedTruck, setClaimedTruck] = useState<ClaimedTruck>(null);
  const [batteries, setBatteries] = useState<Battery[]>([]);

  // Multi-select: a set of selected battery IDs (was a single selectedId before).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Last scan result. highlightId drives the visual pulse on the matched row;
  // scanMsg reports a barcode that is not in this warehouse list.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  // Highlight-and-tap: a scan selects the matching battery and scrolls to it,
  // but never submits. The driver still presses Load to commit.
  function handleScan(code: string) {
    const needle = code.trim().toLowerCase();
    const match = batteries.find(
      (b) =>
        b.barcode?.trim().toLowerCase() === needle ||
        b.serial_number?.trim().toLowerCase() === needle
    );

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

    // Bring the matched row into view on a long list.
    setTimeout(() => {
      document.getElementById(`bat-${match.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/battery/loadable", { cache: "no-store" });
      const data: LoadableResponse = await res.json();

      if (!data.success) {
        if (res.status === 401) {
          router.push("/driver/login");
          return;
        }
        setError(data.error || "Could not load data.");
        return;
      }

      setDriverName(data.driver?.name || "");
      setClaimedTruck(data.claimedTruck || null);
      setBatteries(data.batteries || []);
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

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Loads every selected battery by calling the existing single-battery route
  // once per battery. Keeps the proven route unchanged; loops on the client.
  async function handleLoad() {
    if (selectedIds.size === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    const ids = Array.from(selectedIds);
    let loaded = 0;
    const failures: string[] = [];

    for (const batteryId of ids) {
      try {
        const res = await fetch("/api/battery/load", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batteryId }),
        });
        const data = await res.json();
        if (data.success) {
          loaded += 1;
        } else {
          const bc = batteries.find((b) => b.id === batteryId)?.barcode || batteryId;
          failures.push(`${bc}: ${data.error || "failed"}`);
        }
      } catch {
        const bc = batteries.find((b) => b.id === batteryId)?.barcode || batteryId;
        failures.push(`${bc}: network error`);
      }
    }

    if (loaded > 0) {
      setSuccessMsg(
        `${loaded} batter${loaded === 1 ? "y" : "ies"} loaded onto Truck #${
          claimedTruck?.truck_number ?? "—"
        }.`
      );
    }
    if (failures.length > 0) {
      setError(`Some didn't load — ${failures.join("; ")}`);
    }

    setSelectedIds(new Set());
    await loadData();
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
          <DriverNav />
          <div className="py-10 text-center text-slate-500">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f8fafc" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
        <DriverNav />

        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">Load Batteries</h1>
            {driverName ? (
              <p className="text-sm text-slate-500">Signed in as {driverName}</p>
            ) : null}
          </div>

          {/* Claimed truck banner */}
          {claimedTruck ? (
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
              <p className="text-sm text-slate-400">Loading onto</p>
              <p className="text-lg font-semibold">
                Truck #{claimedTruck.truck_number}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-600 bg-amber-950/30 px-4 py-3">
              <p className="font-semibold text-amber-400">No truck claimed</p>
              <p className="text-sm text-amber-300/80">
                You need to claim a truck before loading batteries.
              </p>
              <button
                onClick={() => router.push("/driver/transfer")}
                className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                Claim a truck
              </button>
            </div>
          )}

          {/* Success / error messages */}
          {successMsg ? (
            <div className="rounded-lg border border-green-600 bg-green-950/30 px-4 py-3 text-green-300">
              {successMsg}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-lg border border-red-600 bg-red-950/30 px-4 py-3 text-red-300">
              {error}
            </div>
          ) : null}

          {/* Battery list (only if a truck is claimed) */}
          {claimedTruck ? (
            batteries.length === 0 ? (
              <p className="py-6 text-center text-slate-500">
                No batteries available to load in the warehouse.
              </p>
            ) : (
              <div className="space-y-2">
                <BarcodeReader onScan={handleScan} label="Scan a battery label" />

                {scanMsg ? (
                  <div className="rounded-lg border border-amber-600 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
                    {scanMsg}
                  </div>
                ) : null}

                <p className="text-sm text-slate-400">
                  Scan or tap batteries to select (you can pick several), then press Load.
                </p>
                {batteries.map((b) => {
                  const isSelected = selectedIds.has(b.id);
                  return (
                    <button
                      key={b.id}
                      id={`bat-${b.id}`}
                      onClick={() => {
                        setHighlightId(null);
                        toggleSelect(b.id);
                      }}
                      className={
                        "w-full rounded-lg border px-4 py-3 text-left transition flex items-center justify-between " +
                        (b.id === highlightId
                          ? "border-green-400 bg-green-950/40 ring-2 ring-green-400"
                          : isSelected
                          ? "border-blue-500 bg-blue-950/40"
                          : "border-slate-700 bg-slate-800/40")
                      }
                    >
                      <span>
                        <span className="font-mono text-sm block">{b.barcode}</span>
                        {b.serial_number ? (
                          <span className="text-xs text-slate-500">
                            S/N {b.serial_number}
                          </span>
                        ) : null}
                      </span>
                      {b.id === highlightId ? (
                        <span className="text-xs font-semibold text-green-400">SCANNED ✓</span>
                      ) : isSelected ? (
                        <span className="text-blue-400 text-lg font-bold">✓</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )
          ) : null}

          {/* Big Load button */}
          {claimedTruck && batteries.length > 0 ? (
            <button
              onClick={handleLoad}
              disabled={selectedIds.size === 0 || submitting}
              className={
                "w-full rounded-lg px-4 py-4 text-center text-lg font-semibold transition " +
                (selectedIds.size === 0 || submitting
                  ? "cursor-not-allowed bg-slate-700 text-slate-400"
                  : "bg-blue-600 text-white")
              }
            >
              {submitting
                ? "Loading…"
                : selectedIds.size > 0
                ? `Load ${selectedIds.size} onto Truck #${claimedTruck.truck_number}`
                : "Select batteries first"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
