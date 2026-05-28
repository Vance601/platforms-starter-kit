"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DriverNav from "@/components/driver-nav";

type OwedCore = {
  core_id: string;
  battery_id: string;
  core_status: string;
  barcode: string;
  serial_number: string | null;
  sold_on_call_number: string | null;
  sold_at: string | null;
};

type ListResponse = {
  success: boolean;
  error?: string;
  cores?: OwedCore[];
};

export default function DriverCoresPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cores, setCores] = useState<OwedCore[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Which core is currently submitting (so we only disable that row).
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Which core has the "No / customer kept" charge field open, and its amount.
  const [keptOpenId, setKeptOpenId] = useState<string | null>(null);
  const [chargeAmounts, setChargeAmounts] = useState<Record<string, string>>({});

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/battery/return-core", { cache: "no-store" });
      const data: ListResponse = await res.json();

      if (!data.success) {
        if (res.status === 401) {
          router.push("/driver/login");
          return;
        }
        setError(data.error || "Could not load data.");
        return;
      }

      setCores(data.cores || []);
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

  async function resolveCore(
    coreId: string,
    decision: "returned" | "kept",
    chargeAmount?: number
  ) {
    if (submittingId) return;
    setSubmittingId(coreId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/battery/return-core", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coreId, decision, chargeAmount }),
      });
      const data = await res.json();

      if (!data.success) {
        if (res.status === 401) {
          router.push("/driver/login");
          return;
        }
        setError(data.error || "Could not record core decision.");
        return;
      }

      setSuccessMsg(
        decision === "returned"
          ? "Core marked returned to MBS."
          : `Customer kept core — $${Number(data.chargeAmount).toFixed(2)} charge recorded.`
      );
      setKeptOpenId(null);
      await loadData();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmittingId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 px-4 py-6 text-slate-100">
        <div className="mx-auto max-w-md">
          <DriverNav />
          <div className="py-10 text-center text-slate-500">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-md">
        <DriverNav />
        <h1 className="mb-1 text-2xl font-bold text-white">Core Returns</h1>
        <p className="mb-5 text-sm text-slate-400">
          For each sold battery, confirm whether you collected the old core.
        </p>

        {error ? (
          <div className="mb-4 rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {successMsg ? (
          <div className="mb-4 rounded-lg bg-emerald-900/40 px-4 py-3 text-sm text-emerald-200">
            {successMsg}
          </div>
        ) : null}

        {cores.length === 0 ? (
          <div className="rounded-lg bg-slate-800 px-4 py-8 text-center text-slate-400">
            No cores owed right now.
          </div>
        ) : (
          <div className="space-y-3">
            {cores.map((c) => {
              const isThisSubmitting = submittingId === c.core_id;
              const disabled = !!submittingId;
              const keptOpen = keptOpenId === c.core_id;
              const chargeVal =
                chargeAmounts[c.core_id] !== undefined
                  ? chargeAmounts[c.core_id]
                  : "25";

              return (
                <div key={c.core_id} className="rounded-lg bg-slate-800 px-4 py-3">
                  <div className="mb-3">
                    <div className="text-base font-semibold text-white">
                      {c.barcode}
                    </div>
                    <div className="text-xs text-slate-400">
                      {c.serial_number ? `SN ${c.serial_number}` : "No serial"}
                      {c.sold_on_call_number
                        ? ` · Call #${c.sold_on_call_number}`
                        : ""}
                    </div>
                  </div>

                  {!keptOpen ? (
                    <div className="flex gap-2">
                      {/* YES — core collected/returned */}
                      <button
                        onClick={() => resolveCore(c.core_id, "returned")}
                        disabled={disabled}
                        className={
                          "flex-1 rounded-lg px-4 py-3 text-center text-base font-semibold transition " +
                          (disabled
                            ? "cursor-not-allowed bg-slate-700 text-slate-400"
                            : "bg-emerald-600 text-white")
                        }
                      >
                        {isThisSubmitting ? "Recording…" : "Yes — Core collected"}
                      </button>

                      {/* NO — opens the charge field */}
                      <button
                        onClick={() => {
                          setKeptOpenId(c.core_id);
                          setError(null);
                          setSuccessMsg(null);
                        }}
                        disabled={disabled}
                        className={
                          "flex-1 rounded-lg px-4 py-3 text-center text-base font-semibold transition " +
                          (disabled
                            ? "cursor-not-allowed bg-slate-700 text-slate-400"
                            : "bg-amber-600 text-white")
                        }
                      >
                        No — Customer kept it
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm text-slate-300">
                        Charge for kept core
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-lg text-slate-400">$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={chargeVal}
                          onChange={(e) =>
                            setChargeAmounts((prev) => ({
                              ...prev,
                              [c.core_id]: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() =>
                            resolveCore(
                              c.core_id,
                              "kept",
                              parseFloat(chargeVal || "25")
                            )
                          }
                          disabled={disabled}
                          className={
                            "flex-1 rounded-lg px-4 py-3 text-center text-base font-semibold transition " +
                            (disabled
                              ? "cursor-not-allowed bg-slate-700 text-slate-400"
                              : "bg-amber-600 text-white")
                          }
                        >
                          {isThisSubmitting
                            ? "Recording…"
                            : `Record $${parseFloat(chargeVal || "25").toFixed(2)} charge`}
                        </button>
                        <button
                          onClick={() => setKeptOpenId(null)}
                          disabled={disabled}
                          className="rounded-lg bg-slate-700 px-4 py-3 text-center text-base font-semibold text-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
