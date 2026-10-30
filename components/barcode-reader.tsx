"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// Real camera QR scanner. Replaces the previous mock component, which called
// setTimeout and returned a random BAT-#### string - it never opened a camera.
//
// html5-qrcode is loaded from a CDN at runtime rather than imported, so this
// needs no build-step change and adds nothing to the bundle until a driver
// actually taps Scan.
//
// Highlight-and-tap by design: onScan reports the decoded string to the parent,
// which highlights the matching row and waits for the driver to confirm. A
// misread never commits inventory on its own.

type Html5QrcodeInstance = {
  start: (
    camera: { facingMode: string },
    config: Record<string, unknown>,
    onSuccess: (decodedText: string) => void,
    onFailure: (msg: string) => void
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
  getRunningTrackCapabilities?: () => MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] };
  applyVideoConstraints?: (c: MediaTrackConstraints) => Promise<void>;
};

declare global {
  interface Window {
    Html5Qrcode?: new (elementId: string, config?: Record<string, unknown>) => Html5QrcodeInstance;
  }
}

// html5-qrcode Html5QrcodeSupportedFormats enum values.
const F = { QR_CODE: 0, CODE_39: 3, CODE_93: 4, CODE_128: 5, DATA_MATRIX: 6, ITF: 8, EAN_13: 9, EAN_8: 10, PDF_417: 11, UPC_A: 14, UPC_E: 15 };
// VIN labels: Code 39 (door jamb / windshield), Code 128, Data Matrix, QR.
const VIN_FORMATS = [F.CODE_39, F.CODE_128, F.DATA_MATRIX, F.QR_CODE];

const CDN =
  "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
const REGION_ID = "bc-scan-region";

function loadLibrary(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Html5Qrcode) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CDN}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = CDN;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("load failed"));
    document.head.appendChild(s);
  });
}

export function BarcodeReader({
  onScan,
  label = "Scan a battery",
  wide = false,
  vin = false,
  accept,
}: {
  onScan?: (value: string) => void;
  label?: string;
  // Wide, short scan box for long 1D barcodes such as a VIN.
  wide?: boolean;
  // VIN mode: restrict to VIN barcode formats, close the camera on a good read.
  vin?: boolean;
  // Optional filter: return the cleaned value to accept, or null to keep scanning.
  accept?: (raw: string) => string | null;
}) {
  // Unique region per instance so two readers can share a page.
  const regionId = useRef(`${REGION_ID}-${Math.random().toString(36).slice(2, 8)}`).current;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "starting" | "running" | "error">("idle");
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState("");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  // Ignore repeat decodes of the same code within a couple of seconds - a QR in
  // frame decodes many times per second.
  const lastRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });

  const stop = useCallback(async () => {
    const inst = scannerRef.current;
    scannerRef.current = null;
    if (!inst) return;
    try {
      await inst.stop();
      inst.clear();
    } catch {
      // Already stopped - nothing to do.
    }
  }, []);

  // Always release the camera when this component goes away.
  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  async function start() {
    setOpen(true);
    setStatus("starting");
    setMessage("");

    try {
      await loadLibrary();
    } catch {
      setStatus("error");
      setMessage("Could not load the scanner. Check your signal, or type the code below.");
      return;
    }

    if (!window.Html5Qrcode) {
      setStatus("error");
      setMessage("Scanner unavailable on this device. Type the code below.");
      return;
    }

    // The scan region div must exist before start() is called.
    await new Promise((r) => setTimeout(r, 50));

    try {
      const inst = new window.Html5Qrcode(regionId, {
        verbose: false,
        ...(vin ? { formatsToSupport: VIN_FORMATS } : {}),
        // Native BarcodeDetector (Android Chrome) is much faster and better at
        // long Code 39; falls back to the ZXing decoder elsewhere (iPhone Safari).
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      });
      scannerRef.current = inst;
      let accepted = false;
      await inst.start(
        { facingMode: "environment" },
        {
          fps: 15,
          // Box scales with the viewfinder: wide+short for 1D VIN barcodes,
          // still tall enough to fit a Data Matrix / QR VIN code.
          qrbox: (w: number, h: number) =>
            wide || vin
              ? { width: Math.max(200, Math.floor(w * 0.9)), height: Math.max(100, Math.floor(Math.min(h, w) * 0.45)) }
              : { width: 240, height: 240 },
          // Rear camera at high resolution: thin Code 39 bars need the pixels.
          videoConstraints: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        (decodedText) => {
          if (accepted) return;
          const now = Date.now();
          const raw = (decodedText || "").trim();
          if (!raw) return;
          if (lastRef.current.value === raw && now - lastRef.current.at < 2000) return;
          lastRef.current = { value: raw, at: now };
          const clean = accept ? accept(raw) : raw;
          if (!clean) {
            setMessage(`Read "${raw.slice(0, 24)}" (not a valid VIN). Hold steady…`);
            return;
          }
          if (navigator.vibrate) navigator.vibrate(60);
          setMessage(clean);
          onScan?.(clean);
          if (vin) {
            accepted = true;
            void close();
          }
        },
        () => {
          // Fires constantly while no code is in frame. Not an error.
        }
      );
      setStatus("running");
      // Continuous autofocus + torch where the browser exposes them
      // (Android Chrome; iPhone Safari autofocuses on its own, no torch API).
      try {
        const caps = inst.getRunningTrackCapabilities?.();
        if (caps?.focusMode?.includes("continuous")) {
          await inst.applyVideoConstraints?.({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
        }
        setTorchAvailable(!!caps?.torch);
      } catch {
        // Optional features only.
      }
    } catch {
      setStatus("error");
      setMessage(
        "Camera blocked. Allow camera access for this site in your browser settings, or type the code below."
      );
    }
  }

  async function toggleTorch() {
    const next = !torchOn;
    try {
      await scannerRef.current?.applyVideoConstraints?.({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }

  async function close() {
    await stop();
    setTorchOn(false);
    setTorchAvailable(false);
    setOpen(false);
    setStatus("idle");
    setMessage("");
  }

  function submitManual() {
    const clean = manual.trim();
    if (!clean) return;
    // Typed values go straight through; the parent validates and shows errors.
    onScan?.(clean);
    setManual("");
    setMessage(clean);
  }

  if (!open) {
    return (
      <button
        onClick={start}
        className="w-full rounded-lg border border-slate-600 bg-slate-800/60 px-4 py-3 text-center font-medium text-slate-100"
      >
        📷 {label}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-slate-400">
          {status === "starting"
            ? "Starting camera..."
            : status === "running"
            ? vin
              ? "Point at the VIN barcode (door jamb or windshield)"
              : "Point at the label"
            : status === "error"
            ? "Scanner problem"
            : ""}
        </span>
        <span className="flex gap-3">
          {torchAvailable ? (
            <button onClick={toggleTorch} className="text-sm text-amber-300 underline">
              {torchOn ? "Light off" : "🔦 Light"}
            </button>
          ) : null}
          <button onClick={close} className="text-sm text-slate-400 underline">
            Close
          </button>
        </span>
      </div>

      {/* html5-qrcode injects the video element into this div. */}
      <div id={regionId} className="overflow-hidden rounded-md" />

      {message ? (
        <p className="mt-2 break-all font-mono text-xs text-green-400">{message}</p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Or type the code"
          autoCapitalize="characters"
          autoCorrect="off"
          className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 font-mono text-sm text-slate-100"
        />
        <button
          onClick={submitManual}
          className="rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-slate-100"
        >
          Use
        </button>
      </div>
    </div>
  );
}

export default BarcodeReader;
