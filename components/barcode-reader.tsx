"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  BATTERY_SCAN_FORMATS,
  VIN_SCAN_FORMATS,
  type ScanFormat,
  decodeCanvas,
  nativeDetectorFormats,
} from "@/lib/scan-decode";
import { normalizeScanText } from "@/lib/scan-code";

// In-app camera scanner for battery labels (QR primary, Code 128 optional)
// and VIN barcodes. We own the camera loop instead of html5-qrcode so:
//   - decoding uses the full video frame (no 240×240 crop / clientWidth mapping)
//   - QR still works on iOS Safari, which often lacks a complete BarcodeDetector
//   - the decoder is bundled (no CDN load in the field)
//   - video is playsInline + muted for iOS
// Highlight-and-tap: onScan reports the cleaned string; the parent still
// confirms before any inventory change.

export function BarcodeReader({
  onScan,
  label = "Scan a battery",
  wide = false,
  vin = false,
  accept,
}: {
  onScan?: (value: string) => void;
  label?: string;
  // Wide viewfinder hint for long 1D VIN barcodes. Decoding still uses the full frame.
  wide?: boolean;
  vin?: boolean;
  accept?: (raw: string) => string | null;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "starting" | "running" | "error">("idle");
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState("");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const loopTimerRef = useRef<number>(0);
  const acceptedRef = useRef(false);
  const lastRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });
  const formatsRef = useRef<ScanFormat[]>(vin ? VIN_SCAN_FORMATS : BATTERY_SCAN_FORMATS);
  const detectorFormatsRef = useRef<ScanFormat[]>([]);
  const onScanRef = useRef(onScan);
  const acceptRef = useRef(accept);
  onScanRef.current = onScan;
  acceptRef.current = accept;
  formatsRef.current = vin ? VIN_SCAN_FORMATS : BATTERY_SCAN_FORMATS;

  const stopStream = useCallback(() => {
    runningRef.current = false;
    if (loopTimerRef.current) {
      window.clearTimeout(loopTimerRef.current);
      loopTimerRef.current = 0;
    }
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  function deliver(raw: string) {
    const now = Date.now();
    const trimmed = normalizeScanText(raw);
    if (!trimmed) return;
    if (lastRef.current.value === trimmed && now - lastRef.current.at < 1800) return;
    lastRef.current = { value: trimmed, at: now };
    const filter = acceptRef.current;
    const clean = filter ? filter(trimmed) || filter(raw) : trimmed;
    if (!clean) {
      setMessage(`Read "${trimmed.slice(0, 24)}" (not a valid VIN). Hold steady…`);
      return;
    }
    if (navigator.vibrate) navigator.vibrate(60);
    setMessage(clean);
    onScanRef.current?.(clean);
    if (vin) {
      acceptedRef.current = true;
      void close();
    }
  }

  async function scanLoop() {
    if (!runningRef.current || acceptedRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState >= 2 && video.videoWidth > 0) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      // Downscale very large frames so jsQR stays snappy on phones, but keep
      // enough pixels for a 1.2" QR and for thin Code 128 / Code 39 bars.
      const scale = Math.min(1, 1280 / Math.max(vw, vh));
      const w = Math.max(1, Math.round(vw * scale));
      const h = Math.max(1, Math.round(vh * scale));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h);
        try {
          const result = await decodeCanvas(canvas, formatsRef.current, {
            detectorFormats: detectorFormatsRef.current,
          });
          if (result?.text && runningRef.current && !acceptedRef.current) {
            deliver(result.text);
          }
        } catch {
          // One bad frame is not fatal.
        }
      }
    }
    if (runningRef.current) {
      loopTimerRef.current = window.setTimeout(scanLoop, vin || wide ? 70 : 90);
    }
  }

  async function openCamera() {
    setOpen(true);
    setStatus("starting");
    setMessage("");
    acceptedRef.current = false;
    setTorchOn(false);
    setTorchAvailable(false);

    const constraintsList: MediaStreamConstraints[] = [
      { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { audio: false, video: { facingMode: { ideal: "environment" } } },
      { audio: false, video: true },
    ];

    let stream: MediaStream | null = null;
    let lastError: unknown = null;
    for (const constraints of constraintsList) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!stream) {
      setStatus("error");
      const name = lastError instanceof DOMException ? lastError.name : "";
      setMessage(
        name === "NotAllowedError"
          ? "Camera blocked. Allow camera access for this site in your browser settings, or type the code below."
          : "Could not open the camera. Type the code below.",
      );
      return;
    }
    streamRef.current = stream;

    // The video element is rendered with open=true; wait one frame for the ref.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const video = videoRef.current;
    if (!video) {
      stopStream();
      setStatus("error");
      setMessage("Could not start the camera view. Type the code below.");
      return;
    }
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      // Autoplay can be rejected; clicking was a user gesture, try once more.
      try {
        await video.play();
      } catch {
        stopStream();
        setStatus("error");
        setMessage("Could not start the camera preview. Type the code below.");
        return;
      }
    }

    detectorFormatsRef.current = await nativeDetectorFormats();
    runningRef.current = true;
    setStatus("running");

    try {
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] }) | undefined;
      if (caps?.focusMode?.includes("continuous")) {
        await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
      }
      setTorchAvailable(!!caps?.torch);
    } catch {
      // Optional features only.
    }
    void scanLoop();
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }

  async function close() {
    stopStream();
    setTorchOn(false);
    setTorchAvailable(false);
    setOpen(false);
    setStatus("idle");
    if (!vin) setMessage("");
  }

  function submitManual() {
    const clean = manual.trim();
    if (!clean) return;
    onScanRef.current?.(clean);
    setManual("");
    setMessage(clean);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openCamera}
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
              : "Point the camera at the QR code"
            : status === "error"
            ? "Scanner problem"
            : ""}
        </span>
        <span className="flex gap-3">
          {torchAvailable ? (
            <button type="button" onClick={toggleTorch} className="text-sm text-amber-300 underline">
              {torchOn ? "Light off" : "🔦 Light"}
            </button>
          ) : null}
          <button type="button" onClick={close} className="text-sm text-slate-400 underline">
            Close
          </button>
        </span>
      </div>

      <div
        className="relative overflow-hidden rounded-md bg-black"
        style={{ minHeight: wide || vin ? 180 : 260 }}
      >
        <video
          ref={videoRef}
          className="block h-auto w-full bg-black"
          style={{ objectFit: "contain", minHeight: wide || vin ? 180 : 260 }}
          playsInline
          muted
          autoPlay
        />
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div
            className="absolute rounded-md"
            style={{
              border: "2px solid rgba(250,250,250,0.85)",
              // Visual guide only — decoding uses the full frame.
              top: vin || wide ? "22%" : "12%",
              bottom: vin || wide ? "22%" : "12%",
              left: vin || wide ? "4%" : "12%",
              right: vin || wide ? "4%" : "12%",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
            }}
          />
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {message ? (
        <p className="mt-2 break-all font-mono text-xs text-green-400">{message}</p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitManual(); } }}
          placeholder="Or type the code"
          autoCapitalize="characters"
          autoCorrect="off"
          className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 font-mono text-sm text-slate-100"
        />
        <button
          type="button"
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
