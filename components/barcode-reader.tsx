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
    config: { fps: number; qrbox: { width: number; height: number } },
    onSuccess: (decodedText: string) => void,
    onFailure: (msg: string) => void
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
};

declare global {
  interface Window {
    Html5Qrcode?: new (elementId: string) => Html5QrcodeInstance;
  }
}

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
}: {
  onScan?: (value: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "starting" | "running" | "error">("idle");
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState("");

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
      const inst = new window.Html5Qrcode(REGION_ID);
      scannerRef.current = inst;
      await inst.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          const now = Date.now();
          const clean = (decodedText || "").trim();
          if (!clean) return;
          if (lastRef.current.value === clean && now - lastRef.current.at < 2000) return;
          lastRef.current = { value: clean, at: now };

          if (navigator.vibrate) navigator.vibrate(60);
          setMessage(clean);
          onScan?.(clean);
        },
        () => {
          // Fires constantly while no code is in frame. Not an error.
        }
      );
      setStatus("running");
    } catch {
      setStatus("error");
      setMessage(
        "Camera blocked. Allow camera access for this site in your browser settings, or type the code below."
      );
    }
  }

  async function close() {
    await stop();
    setOpen(false);
    setStatus("idle");
    setMessage("");
  }

  function submitManual() {
    const clean = manual.trim();
    if (!clean) return;
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
            ? "Point at the label"
            : status === "error"
            ? "Scanner problem"
            : ""}
        </span>
        <button onClick={close} className="text-sm text-slate-400 underline">
          Close
        </button>
      </div>

      {/* html5-qrcode injects the video element into this div. */}
      <div id={REGION_ID} className="overflow-hidden rounded-md" />

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
