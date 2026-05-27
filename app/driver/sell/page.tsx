"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DriverNav from "@/components/driver-nav";

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

type SoldBattery = {
  id: string;
  barcode: string;
  sold_on_call_number: string | null;
};

type SellableResponse = {
  success: boolean;
  error?: string;
  driver?: { id: string; name: string; company_id: string };
  claimedTruck?: ClaimedTruck;
  batteries?: Battery[];
};

export default function DriverSellPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driverName, setDriverName] = useState<string>("");
  const [claimedTruck, setClaimedTruck] = useState<ClaimedTruck>(null);
  const [batteries, setBatteries] = useState<Battery[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [callNumber, setCallNumber] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Warranty state
  const [isWarranty, setIsWarranty] = useState(false);
  const [soldBatteries, setSoldBatteries] = useState<SoldBattery[]>([]);
  const [replacesId, setReplacesId] = useState<string>(""); // "" = none, "OTHER" = not in system
  const [warrantyNote, setWarrantyNote] = useState<string>("");

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/battery/sellable", { cache: "no-store" });
      const data: SellableResponse = await res.json();

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

  async function loadSoldBatteries() {
    try {
      const res = await fetch("/api/battery/sold-list", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setSoldBatteries(data.soldBatteries || []);
      }
    } catch {
      // Non-fatal — the warranty picker just won't have options.
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the driver flips the warranty toggle on, fetch the sold-battery list.
  useEffect(() => {
    if (isWarranty && soldBatteries.length === 0) {
      loadSoldBatteries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWarranty]);

  async function handleSell() {
    if (!canSell) return;
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const payload: Record<string, unknown> = {
        batteryId: selectedId,
        callNumber: callNumber.trim(),
        isWarranty,
      };
      if (isWarranty) {
        if (replacesId === "OTHER") {
          payload.warrantyNote = warrantyNote.trim();
        } else {
          payload.replacesBatteryId = replacesId;
        }
      }

      const res = await fetch("/api/battery/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Could not record sale.");
        return;
      }

      setSuccessMsg(data.message || "Battery sold.");
      // Reset everything.
      setSelectedId(null);
      setCallNumber("");
      setIsWarranty(false);
      setReplacesId("");
      setWarrantyNote("");
      await loadData();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Warranty requires either a picked failed battery OR a note (when OTHER).
  const warrantyOk =
    !isWarranty ||
    (replacesId !== "" && replacesId !== "OTHER") ||
    (replacesId === "OTHER" && warrantyNote.trim() !== "");

  const canSell =
    !!selectedId && !!callNumber.trim() && warrantyOk && !submitting;

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
            <h1 className="text-2xl font-semibold">Sell / Install Battery</h1>
            {driverName ? (
              <p className="text-sm text-slate-500">Signed in as {driverName}</p>
            ) : null}
          </div>

          {/* Claimed truck banner */}
          {claimedTruck ? (
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
              <p className="text-sm text-slate-400">Selling from</p>
              <p className="text-lg font-semibold">
                Truck #{claimedTruck.truck_number}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-600 bg-amber-950/30 px-4 py-3">
              <p className="font-semibold text-amber-400">No truck claimed</p>
              <p className="text-sm text-amber-300/80">
                You need to claim a truck before recording a sale.
              </p>
              <button
                onClick={() => router.push("/driver/transfer")}
                className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                Claim a truck
              </button>
            </div>
          )}

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

          {/* Battery list */}
          {claimedTruck ? (
            batteries.length === 0 ? (
              <p className="py-6 text-center text-slate-500">
                No batteries on your truck to sell.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-400">
                  Tap the battery you installed.
                </p>
                {batteries.map((b) => {
                  const isSelected = b.id === selectedId;
                  return (
                    <button
                      key={b.id}
                      onClick={() => setSelectedId(isSelected ? null : b.id)}
                      className={
                        "w-full rounded-lg border px-4 py-3 text-left transition " +
                        (isSelected
                          ? "border-blue-500 bg-blue-950/40"
                          : "border-slate-700 bg-slate-800/40")
                      }
                    >
                      <p className="font-mono text-sm">{b.barcode}</p>
                      {b.serial_number ? (
                        <p className="text-xs text-slate-500">
                          S/N {b.serial_number}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )
          ) : null}

          {/* Call number */}
          {claimedTruck && batteries.length > 0 ? (
            <div className="space-y-1">
              <label className="text-sm text-slate-400">
                Call number (required)
              </label>
              <input
                type="text"
                value={callNumber}
                onChange={(e) => setCallNumber(e.target.value)}
                placeholder="e.g. 1234567"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          ) : null}

          {/* Warranty toggle */}
          {claimedTruck && batteries.length > 0 ? (
            <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isWarranty}
                  onChange={(e) => {
                    setIsWarranty(e.target.checked);
                    setReplacesId("");
                    setWarrantyNote("");
                  }}
                  className="h-5 w-5"
                />
                <span className="font-medium">
                  Warranty replacement (FREE — $0)
                </span>
              </label>

              {isWarranty ? (
                <div className="mt-3 space-y-2">
                  <label className="text-sm text-slate-400">
                    Which battery failed?
                  </label>
                  <select
                    value={replacesId}
                    onChange={(e) => setReplacesId(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">— Select the failed battery —</option>
                    {soldBatteries.map((sb) => (
                      <option key={sb.id} value={sb.id}>
                        {sb.barcode}
                        {sb.sold_on_call_number
                          ? ` (call #${sb.sold_on_call_number})`
                          : ""}
                      </option>
                    ))}
                    <option value="OTHER">Other / not in system</option>
                  </select>

                  {replacesId === "OTHER" ? (
                    <input
                      type="text"
                      value={warrantyNote}
                      onChange={(e) => setWarrantyNote(e.target.value)}
                      placeholder="Note: old battery info (barcode, date, etc.)"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Big Sell button */}
          {claimedTruck && batteries.length > 0 ? (
            <button
              onClick={handleSell}
              disabled={!canSell}
              className={
                "w-full rounded-lg px-4 py-4 text-center text-lg font-semibold transition " +
                (!canSell
                  ? "cursor-not-allowed bg-slate-700 text-slate-400"
                  : isWarranty
                  ? "bg-emerald-600 text-white"
                  : "bg-blue-600 text-white")
              }
            >
              {submitting
                ? "Recording…"
                : !selectedId
                ? "Select a battery first"
                : !callNumber.trim()
                ? "Enter a call number"
                : !warrantyOk
                ? "Pick the failed battery"
                : isWarranty
                ? "Record Warranty (FREE)"
                : "Record Sale"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
