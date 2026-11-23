"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DriverNav from "@/components/driver-nav";
import BarcodeReader from "@/components/barcode-reader";
import { findScannedItem } from "@/lib/scan-code";
import { VinStep, vinStateMissing, type VinSaleState } from "@/components/vin-step";

type Battery = {
  id: string;
  barcode: string;
  serial_number: string | null;
  status: string;
  truck_id?: string | null;
  truck_number?: string | null;
  current_driver_name?: string | null;
  model_code?: string | null;
};

type SellingDriver = { id: string; name: string };

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
  isWarehouse?: boolean;
  sellHelp?: string | null;
  drivers?: SellingDriver[];
};

export default function DriverSellPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driverName, setDriverName] = useState<string>("");
  const [claimedTruck, setClaimedTruck] = useState<ClaimedTruck>(null);
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [isWarehouse, setIsWarehouse] = useState(false);
  const [sellHelp, setSellHelp] = useState<string | null>(null);
  const [sellingDrivers, setSellingDrivers] = useState<SellingDriver[]>([]);
  const [soldByDriverId, setSoldByDriverId] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [callNumber, setCallNumber] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Core disposition. Default is the customer returns their old battery.
  // If they keep it, an upcharge is owed and the driver enters the amount.
  const [coreKept, setCoreKept] = useState(false);
  const [coreCharge, setCoreCharge] = useState<string>("");

  // Warranty state
  const [isWarranty, setIsWarranty] = useState(false);
  const [soldBatteries, setSoldBatteries] = useState<SoldBattery[]>([]);
  const [replacesId, setReplacesId] = useState<string>(""); // "" = none, "OTHER" = not in system
  const [warrantyNote, setWarrantyNote] = useState<string>("");

  // VIN-first sale (default). "classic" is the old path with no customer record.
  const [vinMode, setVinMode] = useState<"vin" | "classic">("vin");
  const [vinState, setVinState] = useState<VinSaleState | null>(null);
  const groupById = new Map(
    (vinState?.decoded.truckBatteries || []).map((b) => [b.id, b.group] as const)
  );
  const isMatch = (id: string) => !!vinState?.group && groupById.get(id) === vinState.group;
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  function onBatteryScan(code: string) {
    const hit = findScannedItem(batteries, code);
    if (hit) {
      setSelectedId(hit.id);
      const g = groupById.get(hit.id);
      setScanMsg(
        `Selected ${hit.barcode}` +
          (vinState?.group && g && g !== vinState.group ? ` (group ${g}, the vehicle needs ${vinState.group})` : "")
      );
    } else {
      setScanMsg(`${code} is not on your truck. Check the battery or pick it from the list.`);
    }
  }
  const showRest = vinMode === "classic" || !!vinState;
  const vinMissing = vinMode === "vin" ? (vinState ? vinStateMissing(vinState) : "Scan the VIN first") : null;

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
      setIsWarehouse(!!data.isWarehouse);
      setSellHelp(data.sellHelp || null);
      setSellingDrivers(data.drivers || []);
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
        coreKept,
      };
      if (isWarehouse && soldByDriverId) {
        payload.soldByDriverId = soldByDriverId;
      }
      if (coreKept) {
        payload.coreCharge = coreCharge.trim();
      }
      if (vinMode === "vin" && vinState) {
        const v = vinState.decoded.vehicle;
        payload.vehicleSale = {
          vin: v.vin, year: v.year, make: v.make, model: v.model, engine: v.engine,
          customerName: vinState.customerName.trim(),
          customerPhone: vinState.customerPhone.trim(),
          customerEmail: vinState.customerEmail.trim(),
          batteryGroup: vinState.group || null,
          recommendedGroup: vinState.decoded.recommendation?.group || null,
          recommendationSource: vinState.decoded.recommendation?.source || null,
          warrantyMonths: vinState.warrantyMonths,
        };
      }
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

      setSuccessMsg(
        (data.message || "Battery sold.") +
          (data.saleRecord?.warrantyEnd ? ` — warranty through ${data.saleRecord.warrantyEnd}` : "") +
          (data.warning ? ` — ${data.warning}` : "")
      );
      setVinState(null);
      setVinMode("vin");
      // Reset everything.
      setSelectedId(null);
      setCallNumber("");
      setCoreKept(false);
      setCoreCharge("");
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
    !!selectedId && !!callNumber.trim() && warrantyOk && !vinMissing && !submitting && (!isWarehouse || !!soldByDriverId);

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

          {isWarehouse ? (
            <div className="rounded-lg border border-emerald-700 bg-emerald-950/30 px-4 py-3">
              <p className="font-semibold text-emerald-300">Warehouse staff</p>
              <p className="text-sm text-emerald-200/80">
                {sellHelp || "Moving batteries to a truck? Use Transfer. Recording a sale for a driver? Pick the driver."}
              </p>
              <button
                onClick={() => router.push("/driver/transfer")}
                className="mt-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                Go to Transfer
              </button>
            </div>
          ) : claimedTruck ? (
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

          {/* Step 1: VIN (default) */}
          {(isWarehouse || claimedTruck) && batteries.length > 0 && vinMode === "vin" ? (
            <VinStep state={vinState} onChange={setVinState} onSkip={() => { setVinState(null); setVinMode("classic"); }} />
          ) : null}
          {(isWarehouse || claimedTruck) && batteries.length > 0 && vinMode === "classic" ? (
            <button onClick={() => setVinMode("vin")} className="text-xs text-blue-400 underline">
              Selling without a VIN. Switch back to VIN-first sale
            </button>
          ) : null}

          {/* Scan-to-sell: scanning a battery's barcode selects it */}
          {(isWarehouse || claimedTruck) && showRest && batteries.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Scan the battery you&apos;re installing</p>
              <BarcodeReader onScan={onBatteryScan} />
              {scanMsg ? <p className="text-xs text-amber-300">{scanMsg}</p> : null}
            </div>
          ) : null}

          {/* Battery list */}
          {(isWarehouse || claimedTruck) && showRest ? (
            batteries.length === 0 ? (
              <p className="py-6 text-center text-slate-500">
                No batteries on a truck to sell.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-400">
                  Tap the battery you installed.
                </p>
                {[...batteries].sort((a, b) => Number(isMatch(b.id)) - Number(isMatch(a.id))).map((b) => {
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
                      {b.truck_number ? (
                        <p className="text-xs text-slate-400">
                          Truck #{b.truck_number}
                          {b.current_driver_name ? ` · ${b.current_driver_name}` : ""}
                          {b.model_code ? ` · ${b.model_code}` : ""}
                        </p>
                      ) : null}
                      {isMatch(b.id) ? (
                        <p className="text-xs font-semibold text-green-400">✓ Matches group {vinState?.group}</p>
                      ) : null}
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
          {(isWarehouse || claimedTruck) && batteries.length > 0 && showRest ? (
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

          {/* Core disposition */}
          {(isWarehouse || claimedTruck) && batteries.length > 0 && showRest ? (
            <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={coreKept}
                  onChange={(e) => {
                    setCoreKept(e.target.checked);
                    if (!e.target.checked) setCoreCharge("");
                  }}
                  className="h-5 w-5"
                />
                <span className="font-medium">
                  Customer kept their old battery
                </span>
              </label>

              {coreKept ? (
                <div className="mt-3 space-y-2">
                  <label className="text-sm text-slate-400">
                    Core charge amount (required)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-lg text-slate-400">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={coreCharge}
                      onChange={(e) => setCoreCharge(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Recorded against this sale. Payment is collected separately.
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Leave unchecked if the old battery is coming back — a core will
                  be logged as owed.
                </p>
              )}
            </div>
          ) : null}

          {/* Warranty toggle */}
          {(isWarehouse || claimedTruck) && batteries.length > 0 && showRest ? (
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
                      placeholder="Required: old battery info (barcode, date, etc.)"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          
          {isWarehouse && (isWarehouse || claimedTruck) && showRest ? (
            <div className="space-y-2">
              <label className="block text-sm font-semibold">
                Sold by
                <select
                  value={soldByDriverId}
                  onChange={(e) => setSoldByDriverId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Pick the driver who made this sale</option>
                  {sellingDrivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-slate-400">
                Sales are credited to this driver. You are saved as the person who logged it.
              </p>
            </div>
          ) : null}

          {/* Big Sell button */}
          {(isWarehouse || claimedTruck) && batteries.length > 0 && showRest ? (
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
                : vinMissing
                ? vinMissing
                : !callNumber.trim()
                ? "Enter a call number"
                : isWarehouse && !soldByDriverId
                ? "Pick the driver who made this sale"
                : isWarranty && replacesId === ""
                ? "Pick the failed battery"
                : isWarranty && replacesId === "OTHER" && !warrantyNote.trim()
                ? "Add a note about the old battery"
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
