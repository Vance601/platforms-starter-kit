"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SoldBattery = {
  id: string;
  barcode: string;
  serial_number: string | null;
  sold_on_call_number: string | null;
  sold_at: string | null;
};

type ListResponse = {
  success: boolean;
  error?: string;
  batteries?: SoldBattery[];
};

export default function DriverCoresPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batteries, setBatteries] = useState<SoldBattery[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // id of the battery currently being submitted (so we only disable that one row)
  const [submittingId, setSubmittingId] = useState<string | null>(null);

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

  async function handleReturnCore(batteryId: string) {
    if (submittingId) return;
    setSubmittingId(batteryId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/battery/return-core", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batteryId }),
      });
      const data = await res.json();

      if (!data.success) {
        if (res.status === 401) {
          router.push("/driver/login");
          return;
        }
        setError(data.error || "Could not record core return.");
        return;
      }

      setSuccessMsg("Core marked returned to MBS.");
      // Refresh the list so the returned battery drops off.
      await loadData();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmittingId(null);
    }
  }

  if (loading) {
    return (
      <div className="py-10 text-center text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-md">
        <h1 className="mb-1 text-2xl font-bold text-white">Core Returns</h1>
        <p className="mb-5 text-sm text-slate-400">
          Mark sold batteries whose dead core you returned to MBS.
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

        {batteries.length === 0 ? (
          <div className="rounded-lg bg-slate-800 px-4 py-8 text-center text-slate-400">
            No sold batteries waiting on a core return.
          </div>
        ) : (
          <div className="space-y-3">
            {batteries.map((b) => {
              const isThisSubmitting = submittingId === b.id;
              const disabled = !!submittingId;
              return (
                <div
                  key={b.id}
                  className="rounded-lg bg-slate-800 px-4 py-3"
                >
                  <div className="mb-2">
                    <div className="text-base font-semibold text-white">
                      {b.barcode}
                    </div>
                    <div className="text-xs text-slate-400">
                      {b.serial_number ? `SN ${b.serial_number}` : "No serial"}
                      {b.sold_on_call_number
                        ? ` · Call #${b.sold_on_call_number}`
                        : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => handleReturnCore(b.id)}
                    disabled={disabled}
                    className={
                      "w-full rounded-lg px-4 py-3 text-center text-base font-semibold transition " +
                      (disabled
                        ? "cursor-not-allowed bg-slate-700 text-slate-400"
                        : "bg-emerald-600 text-white")
                    }
                  >
                    {isThisSubmitting ? "Recording…" : "Mark Core Returned"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
