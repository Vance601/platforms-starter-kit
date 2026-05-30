"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Location = {
  id: string;
  name: string;
  companyName: string;
};

type Pickup = {
  id: string;
  memo_number: string;
  pickup_date: string;
  total_units: number;
  location_name: string;
};

type Line = { model_code: string; raw_description: string; units: number };

export default function WarrantyPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [tab, setTab] = useState<"pickup" | "memo">("pickup");

  useEffect(() => {
    fetch("/api/receive-order/options")
      .then((r) => r.json())
      .then((data) => setLocations(data.locations || []))
      .catch(() => {});
    loadPickups();
  }, []);

  function loadPickups() {
    fetch("/api/warranty/pickups")
      .then((r) => r.json())
      .then((data) => setPickups(data.pickups || []))
      .catch(() => {});
  }

  return (
    <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <Link href="/" style={{ display: "inline-block", marginBottom: 12, color: "#2563eb", textDecoration: "none", fontSize: 14 }}>
        ← Back to Dashboard
      </Link>
      <h1 style={{ marginBottom: 4 }}>Warranties</h1>
      <p style={{ color: "#666", marginTop: 0, fontSize: 14 }}>
        Record warranties sent back to MBS, then apply the MBS credit memo. Warranty cores should net to $0 — if MBS charged a core, it gets flagged. Inventory is never affected.
      </p>

      <div style={{ display: "flex", gap: 8, margin: "16px 0", borderBottom: "1px solid #ddd" }}>
        <button onClick={() => setTab("pickup")}
          style={{ padding: "10px 18px", border: "none", borderBottom: tab === "pickup" ? "3px solid #0066cc" : "3px solid transparent", background: "none", cursor: "pointer", fontWeight: tab === "pickup" ? 700 : 400 }}>
          1. Warranty Pickup
        </button>
        <button onClick={() => setTab("memo")}
          style={{ padding: "10px 18px", border: "none", borderBottom: tab === "memo" ? "3px solid #0066cc" : "3px solid transparent", background: "none", cursor: "pointer", fontWeight: tab === "memo" ? 700 : 400 }}>
          2. MBS Credit Memo
        </button>
      </div>

      {tab === "pickup" ? (
        <PickupForm locations={locations} onDone={loadPickups} />
      ) : (
        <MemoForm locations={locations} pickups={pickups} />
      )}
    </div>
  );
}

function PickupForm({ locations, onDone }: { locations: Location[]; onDone: () => void }) {
  const [locationId, setLocationId] = useState("");
  const [supplier, setSupplier] = useState("Continental Battery Systems");
  const [memoNumber, setMemoNumber] = useState("");
  const [pickupDate, setPickupDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ model_code: "", raw_description: "", units: 1 }]);
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [validCodes, setValidCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const totalUnits = lines.reduce((s, l) => s + (Number(l.units) || 0), 0);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileObj(file);
    setMediaType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setFileBase64(result.split(",")[1] || "");
    };
    reader.readAsDataURL(file);
  }

  async function scanMemo() {
    setErr("");
    setMsg("");
    if (!fileBase64 || !mediaType) {
      setErr("Choose a memo photo first.");
      return;
    }
    setScanning(true);
    try {
      const res = await fetch("/api/receive-order/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64, mediaType }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Scan failed");
      if (data.invoiceNumber && !memoNumber) setMemoNumber(data.invoiceNumber);
      if (Array.isArray(data.validCodes)) setValidCodes(data.validCodes);
      const scanned: Line[] = (data.lineItems || []).map(
        (li: { mbsCode?: string; mappedCode?: string; quantity?: number }) => ({
          model_code: li.mappedCode || "",
          raw_description: li.mbsCode || "",
          units: Number(li.quantity) || 1,
        })
      );
      if (scanned.length) {
        setLines(scanned);
        setMsg(`Read ${scanned.length} line(s) from the memo. Review and fix anything the reader got wrong, then Save. (Handwriting can be misread.)`);
      } else {
        setErr("No warranty lines were read. Enter them by hand below.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Scan failed — enter lines by hand.");
    } finally {
      setScanning(false);
    }
  }

  function updateLine(i: number, field: keyof Line, val: string | number) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: val } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { model_code: "", raw_description: "", units: 1 }]);
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setErr("");
    setMsg("");
    if (!locationId || !memoNumber) {
      setErr("Location and memo number are required.");
      return;
    }
    setBusy(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      if (fileObj) {
        const fd = new FormData();
        fd.append("file", fileObj);
        const up = await fetch("/api/receive-delivery/upload", { method: "POST", body: fd });
        const upData = await up.json();
        if (upData?.success) {
          fileUrl = upData.url;
          fileName = upData.fileName;
        }
      }
      const res = await fetch("/api/receive-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createWarrantyPickup",
          locationId,
          supplier,
          memoNumber,
          pickupDate,
          notes,
          fileUrl,
          fileName,
          lines: lines.filter((l) => l.units > 0 && l.model_code.trim() !== ""),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to save pickup");
      setMsg(`Warranty pickup ${data.memoNumber} saved — ${data.totalUnits} units sent back. No inventory change.`);
      setMemoNumber("");
      setNotes("");
      setLines([{ model_code: "", raw_description: "", units: 1 }]);
      setFileObj(null);
      setFileBase64("");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {err && <div style={{ background: "#fee", border: "1px solid #c00", padding: 12, borderRadius: 4 }}>{err}</div>}
      {msg && <div style={{ background: "#efe", border: "1px solid #0a0", padding: 12, borderRadius: 4 }}>{msg}</div>}

      <div style={{ background: "#f8f8f8", padding: 16, borderRadius: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label>Pickup Memo #
          <input type="text" value={memoNumber} onChange={(e) => setMemoNumber(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
        <label>Pickup Date
          <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
        <label>Supplier
          <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
        <label>Location
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}>
            <option value="">-- Select location --</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.companyName} — {l.name}</option>)}
          </select>
        </label>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Pickup memo photo (scan to auto-fill lines)</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            <input type="file" accept="application/pdf,image/*" onChange={onFileChange} />
            <button onClick={scanMemo} disabled={scanning || !fileBase64}
              style={{ padding: "8px 16px", background: "#0066cc", color: "white", border: "none", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap" }}>
              {scanning ? "Reading..." : "Read Memo"}
            </button>
          </div>
          <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
            Handwritten memos can be misread — always review the lines below before saving.
          </p>
        </div>
        <label style={{ gridColumn: "1 / -1" }}>Notes (optional)
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Warranties sent back ({totalUnits})</h3>
        <button onClick={addLine} style={{ background: "#eee", border: "none", borderRadius: 4, padding: "6px 12px", cursor: "pointer" }}>+ Add line</button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
            <th style={{ padding: 8 }}>Model code</th>
            <th style={{ padding: 8 }}>Description (optional)</th>
            <th style={{ padding: 8 }}>Qty</th>
            <th style={{ padding: 8 }}></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: 8 }}>
                <input type="text" value={l.model_code} placeholder="e.g. 47AGM"
                  onChange={(e) => updateLine(i, "model_code", e.target.value)}
                  style={{ width: 120, padding: 6, fontFamily: "monospace" }} />
              </td>
              <td style={{ padding: 8 }}>
                <input type="text" value={l.raw_description} placeholder="as written on memo"
                  onChange={(e) => updateLine(i, "raw_description", e.target.value)}
                  style={{ width: "100%", padding: 6 }} />
              </td>
              <td style={{ padding: 8 }}>
                <input type="number" min={0} value={l.units}
                  onChange={(e) => updateLine(i, "units", parseInt(e.target.value, 10) || 0)}
                  style={{ width: 70, padding: 6 }} />
              </td>
              <td style={{ padding: 8 }}>
                <button onClick={() => removeLine(i)}
                  style={{ background: "none", border: "1px solid #ccc", borderRadius: 4, padding: "4px 8px", cursor: "pointer", color: "#c00" }}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={submit} disabled={busy || totalUnits === 0}
        style={{ padding: "12px 24px", background: "#0066cc", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
        {busy ? "Saving..." : `Save Warranty Pickup (${totalUnits})`}
      </button>
    </div>
  );
}

function MemoForm({ locations, pickups }: { locations: Location[]; pickups: Pickup[] }) {
  const [locationId, setLocationId] = useState("");
  const [warrantyPickupId, setWarrantyPickupId] = useState("");
  const [memoNumber, setMemoNumber] = useState("");
  const [memoDate, setMemoDate] = useState(new Date().toISOString().split("T")[0]);
  const [warrantyCount, setWarrantyCount] = useState("");
  const [coreCharges, setCoreCharges] = useState("");
  const [coreCredits, setCoreCredits] = useState("");
  const [notes, setNotes] = useState("");
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ flagged: boolean; message: string; coreNet: number } | null>(null);
  const [err, setErr] = useState("");

  const charged = parseInt(coreCharges, 10) || 0;
  const credited = parseInt(coreCredits, 10) || 0;
  const net = charged - credited;
  const willFlag = net > 0;

  async function submit() {
    setErr("");
    setResult(null);
    if (!locationId || !memoNumber) {
      setErr("Location and credit memo number are required.");
      return;
    }
    setBusy(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      if (fileObj) {
        const fd = new FormData();
        fd.append("file", fileObj);
        const up = await fetch("/api/receive-delivery/upload", { method: "POST", body: fd });
        const upData = await up.json();
        if (upData?.success) {
          fileUrl = upData.url;
          fileName = upData.fileName;
        }
      }
      const res = await fetch("/api/receive-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "applyWarrantyCreditMemo",
          locationId,
          warrantyPickupId: warrantyPickupId || null,
          memoNumber,
          memoDate,
          warrantyCount: parseInt(warrantyCount, 10) || null,
          coreCharges: charged,
          coreCredits: credited,
          notes,
          fileUrl,
          fileName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to apply credit memo");
      setResult({ flagged: data.flagged, message: data.message, coreNet: data.coreNet });
      setMemoNumber("");
      setCoreCharges("");
      setCoreCredits("");
      setWarrantyCount("");
      setNotes("");
      setFileObj(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {err && <div style={{ background: "#fee", border: "1px solid #c00", padding: 12, borderRadius: 4 }}>{err}</div>}
      {result && (
        <div style={{ background: result.flagged ? "#fff4f4" : "#f0fff4", border: "1px solid " + (result.flagged ? "#c00" : "#0a0"), padding: 14, borderRadius: 6 }}>
          <strong style={{ color: result.flagged ? "#c00" : "#0a0" }}>{result.flagged ? "⚠ FLAGGED" : "✓ Clean"}</strong>
          <div style={{ marginTop: 4 }}>{result.message}</div>
        </div>
      )}

      <div style={{ background: "#f8f8f8", padding: 16, borderRadius: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label>Credit Memo #
          <input type="text" value={memoNumber} onChange={(e) => setMemoNumber(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
        <label>Memo Date
          <input type="date" value={memoDate} onChange={(e) => setMemoDate(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
        <label>Location
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}>
            <option value="">-- Select location --</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.companyName} — {l.name}</option>)}
          </select>
        </label>
        <label>Link to Warranty Pickup (optional)
          <select value={warrantyPickupId} onChange={(e) => setWarrantyPickupId(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}>
            <option value="">-- None --</option>
            {pickups.map((p) => <option key={p.id} value={p.id}>{p.memo_number} ({p.total_units} units)</option>)}
          </select>
        </label>
        <label>Warranty Count (optional)
          <input type="number" min={0} value={warrantyCount} onChange={(e) => setWarrantyCount(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
        <div />
        <label>Cores Charged (from memo)
          <input type="number" min={0} placeholder="should be 0" value={coreCharges} onChange={(e) => setCoreCharges(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
        <label>Core Credits (from memo)
          <input type="number" min={0} placeholder="from memo" value={coreCredits} onChange={(e) => setCoreCredits(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
        <div style={{ gridColumn: "1 / -1", background: willFlag ? "#fff4f4" : "#f0fff4", border: "1px solid " + (willFlag ? "#f3c0c0" : "#bfe6c9"), borderRadius: 6, padding: "10px 12px" }}>
          <strong>Warranty core net: {net}</strong>
          <span style={{ color: "#666", fontSize: 13 }}>
            {" "}(charged {charged} − credited {credited}). Warranty cores should net to <strong>0</strong>.
            {willFlag ? " This will be FLAGGED — MBS charged for cores that should be free." : " Looks correct."}
          </span>
        </div>
        <label style={{ gridColumn: "1 / -1" }}>Credit memo file (optional)
          <input type="file" accept="application/pdf,image/*" onChange={(e) => setFileObj(e.target.files?.[0] || null)}
            style={{ display: "block", marginTop: 4 }} />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>Notes (optional)
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }} />
        </label>
      </div>

      <button onClick={submit} disabled={busy}
        style={{ padding: "12px 24px", background: "#0066cc", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
        {busy ? "Applying..." : "Apply Credit Memo"}
      </button>
    </div>
  );
}
