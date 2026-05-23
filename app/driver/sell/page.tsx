"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSell() {
    if (!selectedId || !callNumber.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/battery/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batteryId: selectedId, callNumber: callNumber.trim() }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Could not record sale.");
        return;
      }

      setSuccessMsg(data.message || "Battery sold.");
      setSelectedId(null);
      setCallNumber("");
      // Refresh — the sold battery is no longer on the truck.
      await loadData();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="py-10 text-center text-slate-500">
        Loading…
      </div>
    );
  }

  const canSell = !!selectedId && !!callNumber.trim() && !submitting;

  return (
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
          <p className="text-lg font-semibold">Truck #{claimedTruck.truck_number}</p>
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

      {/* Call number input */}
      {claimedTruck && batteries.length > 0 ? (
        <div className="space-y-1">
          <label className="text-sm text-slate-400">Call number (required)</label>
          <input
            type="text"
            inputMode="text"
            value={callNumber}
            onChange={(e) => setCallNumber(e.target.value)}
            placeholder="e.g. 1234567"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
          />
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
              : "bg-blue-600 text-white")
          }
        >
          {submitting
            ? "Recording sale…"
            : !selectedId
            ? "Select a battery first"
            : !callNumber.trim()
            ? "Enter a call number"
            : "Record Sale"}
        </button>
      ) : null}
    </div>
  );
}
