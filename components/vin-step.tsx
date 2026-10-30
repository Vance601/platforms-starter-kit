"use client";

// VIN-first sale, step 1. Scan / type / photograph the VIN, decode it, show the
// recommended battery group (history first, AI suggestion clearly labelled),
// and collect the customer and warranty details. The parent page keeps the
// battery picker, call number, core and warranty-replacement controls.
import { useRef, useState } from "react";
import { BarcodeReader } from "@/components/barcode-reader";

export type VinVehicle = { vin: string; year: string | null; make: string | null; model: string | null; engine: string | null };
export type TruckBattery = { id: string; barcode: string; serial_number: string | null; group: string | null };
export type VinDecodeResult = {
  vehicle: VinVehicle;
  recommendation: { group: string; source: "history" | "ai"; detail: string } | null;
  aiNote: string | null;
  validCodes: string[];
  truckBatteries: TruckBattery[];
  warrantyTerms: number[];
  defaultWarrantyMonths: number;
};
export type VinSaleState = {
  decoded: VinDecodeResult;
  group: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  warrantyMonths: number;
};

const input =
  "w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none";

// Shrink a camera photo before upload (phones produce 5-12 MB images).
async function photoToJpegBase64(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85).split(",")[1] || "";
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function VinStep({
  state,
  onChange,
  onSkip,
}: {
  state: VinSaleState | null;
  onChange: (s: VinSaleState | null) => void;
  onSkip: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function lookup(raw: string) {
    setBusy("Looking up VIN…");
    setError(null);
    try {
      const res = await fetch("/api/vin/decode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: raw }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Could not look up that VIN.");
        if (data.vin) setTyped(data.vin);
        return;
      }
      const d = data as VinDecodeResult;
      onChange({
        decoded: d,
        group: d.recommendation?.group || "",
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        warrantyMonths: d.defaultWarrantyMonths,
      });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function readPhoto(file: File) {
    setBusy("Reading VIN from photo…");
    setError(null);
    try {
      const imageBase64 = await photoToJpegBase64(file);
      const res = await fetch("/api/vin/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mediaType: "image/jpeg" }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Couldn't read the photo.");
        return;
      }
      setTyped(data.vin);
      if (data.valid) {
        await lookup(data.vin);
      } else {
        setError(`Read "${data.vin}" but ${data.warning} Fix it below and tap Look up.`);
      }
    } catch {
      setError("Couldn't read the photo. Type the VIN instead.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!state) {
    return (
      <div className="space-y-3 rounded-lg border border-blue-700 bg-blue-950/20 px-4 py-4">
        <div>
          <p className="font-semibold">Step 1 · Scan the vehicle VIN</p>
          <p className="text-xs text-slate-400">Windshield plate or driver door-jamb barcode.</p>
        </div>
        <BarcodeReader wide onScan={(v) => void lookup(v)} label="Scan VIN barcode" />
        <div className="flex gap-2">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value.toUpperCase())}
            placeholder="Or type the 17-character VIN"
            maxLength={18}
            autoCapitalize="characters"
            autoCorrect="off"
            className={input + " font-mono"}
          />
          <button
            onClick={() => void lookup(typed)}
            disabled={!typed.trim() || !!busy}
            className="rounded-lg bg-blue-600 px-4 font-medium text-white disabled:bg-slate-700"
          >
            Look up
          </button>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
          className="w-full rounded-lg border border-slate-600 bg-slate-800/60 px-4 py-3 font-medium"
        >
          🖼️ Barcode won&apos;t scan? Take a photo of the VIN
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readPhoto(f);
          }}
        />
        {busy ? <p className="text-sm text-blue-300">{busy}</p> : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button onClick={onSkip} className="text-xs text-slate-500 underline">
          No VIN available — sell without customer details (old way)
        </button>
      </div>
    );
  }

  const { decoded } = state;
  const v = decoded.vehicle;
  const rec = decoded.recommendation;
  const matching = decoded.truckBatteries.filter((b) => state.group && b.group === state.group).length;
  const set = (p: Partial<VinSaleState>) => onChange({ ...state, ...p });

  return (
    <div className="space-y-3 rounded-lg border border-blue-700 bg-blue-950/20 px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold">
            {[v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle not identified"}
          </p>
          <p className="text-xs text-slate-400">{v.engine ? `${v.engine} · ` : ""}<span className="font-mono">{v.vin}</span></p>
        </div>
        <button onClick={() => onChange(null)} className="text-xs text-slate-400 underline">
          Change VIN
        </button>
      </div>

      {rec ? (
        rec.source === "history" ? (
          <div className="rounded-md border border-green-700 bg-green-950/30 px-3 py-2">
            <p className="font-semibold text-green-300">Recommended: group {rec.group}</p>
            <p className="text-xs text-green-200/80">{rec.detail}</p>
          </div>
        ) : (
          <div className="rounded-md border border-amber-600 bg-amber-950/30 px-3 py-2">
            <p className="font-semibold text-amber-300">AI suggestion (not verified): group {rec.group}</p>
            <p className="text-xs text-amber-200/80">{rec.detail}{decoded.aiNote ? ` ${decoded.aiNote}` : ""}</p>
          </div>
        )
      ) : (
        <div className="rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-slate-300">
          No recommendation for this vehicle yet. Check the old battery and pick the group below.
        </div>
      )}

      <div className="space-y-1">
        <label className="text-sm text-slate-400">Battery group to install (confirm or change)</label>
        <select value={state.group} onChange={(e) => set({ group: e.target.value })} className={input}>
          <option value="">— Pick group —</option>
          {decoded.validCodes.map((c) => (
            <option key={c} value={c}>
              {c}
              {rec?.group === c ? (rec.source === "history" ? " (recommended)" : " (AI suggestion)") : ""}
            </option>
          ))}
        </select>
        {state.group ? (
          <p className={"text-xs " + (matching ? "text-green-400" : "text-amber-400")}>
            {matching ? `${matching} matching batter${matching === 1 ? "y" : "ies"} on your truck (marked below).` : "None on your truck in this group."}
          </p>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-slate-700 pt-3">
        <p className="font-semibold">Customer</p>
        <input value={state.customerName} onChange={(e) => set({ customerName: e.target.value })} placeholder="Customer name (required)" className={input} />
        <input value={state.customerPhone} onChange={(e) => set({ customerPhone: e.target.value })} placeholder="Mobile phone (required)" type="tel" inputMode="tel" className={input} />
        <input value={state.customerEmail} onChange={(e) => set({ customerEmail: e.target.value })} placeholder="Email (optional)" type="email" inputMode="email" className={input} />
        <div className="space-y-1">
          <label className="text-sm text-slate-400">Warranty term</label>
          <select value={state.warrantyMonths} onChange={(e) => set({ warrantyMonths: Number(e.target.value) })} className={input}>
            {decoded.warrantyTerms.map((m) => (
              <option key={m} value={m}>{m} months</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export function vinStateMissing(s: VinSaleState | null): string | null {
  if (!s) return null;
  if (!s.customerName.trim()) return "Enter the customer's name";
  const d = s.customerPhone.replace(/\D/g, "");
  if (!(d.length === 10 || (d.length === 11 && d.startsWith("1")))) return "Enter a 10-digit phone";
  return null;
}
