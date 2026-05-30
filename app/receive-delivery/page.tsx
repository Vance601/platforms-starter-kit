"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Location = {
  id: string;
  name: string;
  locationSlug: string;
  companyName: string;
  companySlug: string;
};

type ScanLine = {
  mbsCode: string;
  mappedCode: string;
  quantity: number;
  agm: boolean;
  confident: boolean;
};

export default function ReceiveDeliveryPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [step, setStep] = useState<"upload" | "review" | "committing" | "done">("upload");

  // Header fields
  const [receiptNumber, setReceiptNumber] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [locationId, setLocationId] = useState("");
  const [coreCount, setCoreCount] = useState("");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);
  const [supplier, setSupplier] = useState("Continental Battery Systems");

  const [scanLines, setScanLines] = useState<ScanLine[]>([]);
  const [validCodes, setValidCodes] = useState<string[]>([]);

  const [fileName, setFileName] = useState("");
  const [fileBase64, setFileBase64] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [fileObj, setFileObj] = useState<File | null>(null);

  const [error, setError] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [commitProgress, setCommitProgress] = useState("");
  const [doneSummary, setDoneSummary] = useState("");

  useEffect(() => {
    fetch("/api/receive-order/options")
      .then((r) => r.json())
      .then((data) => {
        setLocations(data.locations || []);
        setValidCodes((data.models || []).map((m: { code: string }) => m.code));
      })
      .catch(() => setError("Could not load locations and models"));
  }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileObj(file);
    setFileName(file.name);
    setMediaType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setFileBase64(result.split(",")[1] || "");
    };
    reader.readAsDataURL(file);
  }

  async function readReceipt() {
    setError("");
    if (!fileBase64 || !mediaType) {
      setError("Please choose a delivery receipt file first.");
      return;
    }
    setIsScanning(true);
    try {
      const res = await fetch("/api/receive-order/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64, mediaType }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Scan failed");
      setReceiptNumber(data.invoiceNumber || "");
      setPoNumber(data.poNumber || "");
      if (data.invoiceDate) setReceiptDate(data.invoiceDate);
      setScanLines(data.lineItems || []);
      // Pre-fill bulk cores from the scanned core lines if present.
      if (Array.isArray(data.coreLines) && data.coreLines.length) {
        const coreTotal = data.coreLines.reduce(
          (s: number, c: { quantity: number }) => s + (Number(c.quantity) || 0),
          0
        );
        if (coreTotal > 0) setCoreCount(String(coreTotal));
      }
      if (Array.isArray(data.validCodes) && data.validCodes.length) setValidCodes(data.validCodes);
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsScanning(false);
    }
  }

  function updateLine(index: number, field: keyof ScanLine, value: string | number) {
    setScanLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    );
  }

  function removeLine(index: number) {
    setScanLines((prev) => prev.filter((_, i) => i !== index));
  }

  function addLine() {
    setScanLines((prev) => [
      ...prev,
      { mbsCode: "(manual)", mappedCode: validCodes[0] || "", quantity: 1, agm: false, confident: true },
    ]);
  }

  const totalBatteries = scanLines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);

  async function commit() {
    setError("");
    if (!locationId) {
      setError("Please select a location.");
      return;
    }
    if (!receiptNumber) {
      setError("Receipt number is required.");
      return;
    }
    const badLine = scanLines.find((l) => !validCodes.includes(l.mappedCode));
    if (badLine) {
      setError(`Line "${badLine.mbsCode}" has no valid model code. Fix it before committing.`);
      return;
    }

    setStep("committing");
    try {
      // 1) Upload the file to Blob (if one was chosen).
      let fileUrl: string | null = null;
      let uploadedName: string | null = null;
      if (fileObj) {
        setCommitProgress("Uploading file...");
        const fd = new FormData();
        fd.append("file", fileObj);
        const upRes = await fetch("/api/receive-delivery/upload", { method: "POST", body: fd });
        const upData = await upRes.json();
        if (upData?.success) {
          fileUrl = upData.url;
          uploadedName = upData.fileName;
        }
      }

      // 2) Create the delivery receipt header.
      setCommitProgress("Creating delivery receipt...");
      const createRes = await fetch("/api/receive-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createDeliveryReceipt",
          locationId,
          supplier,
          receiptNumber,
          poNumber,
          receiptDate,
          coreCharges: parseInt(coreCount, 10) || 0,
          fileUrl,
          fileName: uploadedName,
          totalUnits: totalBatteries,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.success)
        throw new Error(createData.error || "Failed to create delivery receipt");
      const deliveryReceiptId = createData.deliveryReceiptId;

      // 3) Add each battery (cost-free), quantity times.
      let logged = 0;
      for (const line of scanLines) {
        for (let i = 0; i < line.quantity; i++) {
          const addRes = await fetch("/api/receive-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "addBatteryFromDelivery",
              deliveryReceiptId,
              batteryModelCode: line.mappedCode,
              rawDescription: line.mbsCode,
            }),
          });
          const addData = await addRes.json();
          if (!addRes.ok || !addData.success)
            throw new Error(addData.error || `Failed adding ${line.mappedCode}`);
          logged++;
          setCommitProgress(`Adding batteries... ${logged} of ${totalBatteries}`);
        }
      }

      setDoneSummary(
        `Delivery receipt ${receiptNumber}: ${logged} batteries added to inventory (no cost yet). ${
          parseInt(coreCount, 10) || 0
        } cores recorded. Cost will be filled in when the MBS invoice is received.`
      );
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStep("review");
    }
  }

  return (
    <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <Link href="/receive-order" style={{ display: "inline-block", marginBottom: 12, color: "#2563eb", textDecoration: "none", fontSize: 14 }}>
        ← Back to Receive Order
      </Link>
      <h1 style={{ marginBottom: "8px" }}>Delivery Receipt (Day 0)</h1>
      <p style={{ color: "#666", marginTop: 0, fontSize: 14 }}>
        Upload the supplier delivery receipt. Batteries are added to inventory now, with no cost — pricing is filled in later when the MBS invoice arrives.
      </p>

      {error && (
        <div style={{ background: "#fee", border: "1px solid #c00", padding: "12px", marginBottom: "16px", borderRadius: "4px" }}>
          {error}
        </div>
      )}

      {step === "upload" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ border: "2px dashed #ccc", borderRadius: "8px", padding: "32px", textAlign: "center" }}>
            <p style={{ marginBottom: "12px", color: "#666" }}>
              Upload a delivery receipt (PDF or photo). It will be read automatically — you review before anything is added.
            </p>
            <input type="file" accept="application/pdf,image/*" onChange={onFileChange} />
            {fileName && <p style={{ marginTop: "12px", fontWeight: 600 }}>{fileName}</p>}
          </div>
          <button
            onClick={readReceipt}
            disabled={isScanning || !fileBase64}
            style={{ padding: "12px", background: "#0066cc", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "16px" }}
          >
            {isScanning ? "Reading receipt..." : "Read Receipt"}
          </button>
        </div>
      )}

      {step === "review" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "#f8f8f8", padding: "16px", borderRadius: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label>
              Receipt Number
              <input type="text" value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)}
                style={{ display: "block", width: "100%", padding: "8px", marginTop: "4px" }} />
            </label>
            <label>
              P.O. Number
              <input type="text" value={poNumber} onChange={(e) => setPoNumber(e.target.value)}
                style={{ display: "block", width: "100%", padding: "8px", marginTop: "4px" }} />
            </label>
            <label>
              Receipt Date
              <input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)}
                style={{ display: "block", width: "100%", padding: "8px", marginTop: "4px" }} />
            </label>
            <label>
              Supplier
              <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)}
                style={{ display: "block", width: "100%", padding: "8px", marginTop: "4px" }} />
            </label>
            <label>
              Total Cores (bulk)
              <input type="number" min={0} value={coreCount} onChange={(e) => setCoreCount(e.target.value)}
                style={{ display: "block", width: "100%", padding: "8px", marginTop: "4px" }} />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Location (where these batteries land)
              <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
                style={{ display: "block", width: "100%", padding: "8px", marginTop: "4px" }}>
                <option value="">-- Select location --</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.companyName} — {loc.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Batteries found ({totalBatteries})</h3>
            <button onClick={addLine}
              style={{ background: "#eee", border: "none", borderRadius: 4, padding: "6px 12px", cursor: "pointer" }}>
              + Add line
            </button>
          </div>
          <p style={{ fontSize: "13px", color: "#666", marginTop: "0" }}>
            Review each line. Yellow rows need attention (the reader wasn't confident — check the AGM/standard mapping).
          </p>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                <th style={{ padding: "8px" }}>Receipt code</th>
                <th style={{ padding: "8px" }}>Your model</th>
                <th style={{ padding: "8px" }}>Qty</th>
                <th style={{ padding: "8px" }}></th>
              </tr>
            </thead>
            <tbody>
              {scanLines.map((line, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #eee", background: line.confident ? "transparent" : "#fffbe6" }}>
                  <td style={{ padding: "8px", fontFamily: "monospace" }}>{line.mbsCode}</td>
                  <td style={{ padding: "8px" }}>
                    <select value={line.mappedCode} onChange={(e) => updateLine(i, "mappedCode", e.target.value)}
                      style={{ padding: "6px", width: "120px" }}>
                      {!validCodes.includes(line.mappedCode) && (
                        <option value={line.mappedCode}>{line.mappedCode} (?)</option>
                      )}
                      {validCodes.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "8px" }}>
                    <input type="number" value={line.quantity} min={0}
                      onChange={(e) => updateLine(i, "quantity", parseInt(e.target.value, 10) || 0)}
                      style={{ width: "70px", padding: "6px" }} />
                  </td>
                  <td style={{ padding: "8px" }}>
                    <button onClick={() => removeLine(i)}
                      style={{ background: "none", border: "1px solid #ccc", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", color: "#c00" }}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={() => setStep("upload")}
              style={{ padding: "12px 24px", background: "#eee", border: "none", borderRadius: "4px", cursor: "pointer" }}>
              Back
            </button>
            <button onClick={commit} disabled={totalBatteries === 0}
              style={{ padding: "12px 24px", background: "#0c0", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", flex: 1 }}>
              Confirm &amp; Add {totalBatteries} to Inventory
            </button>
          </div>
        </div>
      )}

      {step === "committing" && (
        <div style={{ textAlign: "center", padding: "48px" }}>
          <p style={{ fontSize: "18px" }}>{commitProgress || "Working..."}</p>
          <p style={{ color: "#666" }}>Please don&apos;t close this page.</p>
        </div>
      )}

      {step === "done" && (
        <div style={{ textAlign: "center", padding: "48px" }}>
          <h2 style={{ color: "#0a0" }}>Done</h2>
          <p style={{ fontSize: "16px" }}>{doneSummary}</p>
          <div style={{ marginTop: "24px", display: "flex", gap: "12px", justifyContent: "center" }}>
            <button onClick={() => { window.location.href = "/batteries"; }}
              style={{ padding: "12px 24px", background: "#0066cc", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
              View Batteries
            </button>
            <button onClick={() => { window.location.reload(); }}
              style={{ padding: "12px 24px", background: "#eee", border: "none", borderRadius: "4px", cursor: "pointer" }}>
              Receive Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
