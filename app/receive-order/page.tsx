"use client";

import { useState, useEffect } from "react";

type Location = {
  id: string;
  name: string;
  locationSlug: string;
  companyName: string;
  companySlug: string;
};

type Model = {
  code: string;
  displayName: string;
  classification: string;
};

type ScanLine = {
  mbsCode: string;
  mappedCode: string;
  quantity: number;
  agm: boolean;
  confident: boolean;
};

type CoreLine = { description: string; quantity: number };

export default function ReceiveOrderPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [step, setStep] = useState<"upload" | "review" | "committing" | "done">("upload");

  // Header fields
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [locationId, setLocationId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);

  // Scan results
  const [scanLines, setScanLines] = useState<ScanLine[]>([]);
  const [coreLines, setCoreLines] = useState<CoreLine[]>([]);
  const [validCodes, setValidCodes] = useState<string[]>([]);

  const [fileName, setFileName] = useState("");
  const [fileBase64, setFileBase64] = useState("");
  const [mediaType, setMediaType] = useState("");

  const [error, setError] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [commitProgress, setCommitProgress] = useState("");
  const [doneSummary, setDoneSummary] = useState("");

  useEffect(() => {
    fetch("/api/receive-order/options")
      .then((r) => r.json())
      .then((data) => {
        setLocations(data.locations || []);
        setModels(data.models || []);
        setValidCodes((data.models || []).map((m: Model) => m.code));
      })
      .catch(() => setError("Could not load locations and models"));
  }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setMediaType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setFileBase64(result.split(",")[1] || "");
    };
    reader.readAsDataURL(file);
  }

  async function readInvoice() {
    setError("");
    if (!fileBase64 || !mediaType) {
      setError("Please choose an invoice file first.");
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
      setInvoiceNumber(data.invoiceNumber || "");
      setPoNumber(data.poNumber || "");
      setTotalAmount(data.totalAmount ? String(data.totalAmount) : "");
      if (data.invoiceDate) setInvoiceDate(data.invoiceDate);
      setScanLines(data.lineItems || []);
      setCoreLines(data.coreLines || []);
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

  const totalBatteries = scanLines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);

  async function commitToInventory() {
    setError("");
    if (!locationId) {
      setError("Please select a location.");
      return;
    }
    if (!invoiceNumber) {
      setError("Invoice number is required.");
      return;
    }
    const badLine = scanLines.find((l) => !validCodes.includes(l.mappedCode));
    if (badLine) {
      setError(`Line "${badLine.mbsCode}" has no valid model code. Fix it before committing.`);
      return;
    }

    setStep("committing");
    try {
      // 1) Create the invoice header (reuses existing route)
      setCommitProgress("Creating invoice...");
      const createRes = await fetch("/api/receive-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createInvoice",
          invoiceNumber,
          locationId,
          totalAmount: parseFloat(totalAmount) || 0,
          batteryCount: totalBatteries,
          invoiceDate,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || "Failed to create invoice");
      const invoiceId = createData.invoiceId;

      // 2) Log each battery, quantity times, via existing addBattery
      let logged = 0;
      for (const line of scanLines) {
        for (let i = 0; i < line.quantity; i++) {
          const addRes = await fetch("/api/receive-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "addBattery",
              invoiceId,
              batteryModelCode: line.mappedCode,
            }),
          });
          const addData = await addRes.json();
          if (!addRes.ok) throw new Error(addData.error || `Failed adding ${line.mappedCode}`);
          logged++;
          setCommitProgress(`Adding batteries... ${logged} of ${totalBatteries}`);
        }
      }

      // 3) Finish / reconcile
      setCommitProgress("Finishing...");
      const finishRes = await fetch("/api/receive-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finishInvoice", invoiceId }),
      });
      const finishData = await finishRes.json();
      if (!finishRes.ok) throw new Error(finishData.error || "Failed to finish invoice");

      setDoneSummary(
        `Invoice ${invoiceNumber}: ${finishData.actual} batteries added (expected ${finishData.expected}). Status: ${finishData.status}.`
      );
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStep("review");
    }
  }

  return (
    <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: "24px" }}>Receive Order</h1>

      {error && (
        <div style={{ background: "#fee", border: "1px solid #c00", padding: "12px", marginBottom: "16px", borderRadius: "4px" }}>
          {error}
        </div>
      )}

      {step === "upload" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ border: "2px dashed #ccc", borderRadius: "8px", padding: "32px", textAlign: "center" }}>
            <p style={{ marginBottom: "12px", color: "#666" }}>
              Upload an MBS invoice (PDF or photo). It will be read automatically — you review before anything is added.
            </p>
            <input type="file" accept="application/pdf,image/*" onChange={onFileChange} />
            {fileName && <p style={{ marginTop: "12px", fontWeight: 600 }}>{fileName}</p>}
          </div>
          <button
            onClick={readInvoice}
            disabled={isScanning || !fileBase64}
            style={{ padding: "12px", background: "#0066cc", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "16px" }}
          >
            {isScanning ? "Reading invoice..." : "Read Invoice"}
          </button>
        </div>
      )}

      {step === "review" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "#f8f8f8", padding: "16px", borderRadius: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label>
              Invoice Number
              <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}
                style={{ display: "block", width: "100%", padding: "8px", marginTop: "4px" }} />
            </label>
            <label>
              P.O. Number
              <input type="text" value={poNumber} onChange={(e) => setPoNumber(e.target.value)}
                style={{ display: "block", width: "100%", padding: "8px", marginTop: "4px" }} />
            </label>
            <label>
              Invoice Date
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                style={{ display: "block", width: "100%", padding: "8px", marginTop: "4px" }} />
            </label>
            <label>
              Total Amount ($)
              <input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)}
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

          <h3 style={{ marginBottom: "0" }}>Batteries found ({totalBatteries})</h3>
          <p style={{ fontSize: "13px", color: "#666", marginTop: "0" }}>
            Review each line. Yellow rows need your attention (the reader wasn't confident — check the AGM/standard mapping).
          </p>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                <th style={{ padding: "8px" }}>Invoice code</th>
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

          {coreLines.length > 0 && (
            <div style={{ background: "#eef", padding: "12px", borderRadius: "8px", fontSize: "13px" }}>
              <strong>Core charges found (not added to inventory):</strong>
              <ul style={{ margin: "8px 0 0", paddingLeft: "20px" }}>
                {coreLines.map((c, i) => (
                  <li key={i}>{c.description}: {c.quantity}</li>
                ))}
              </ul>
              <p style={{ margin: "8px 0 0", color: "#666" }}>Core verification is a separate feature — these are shown for reference only.</p>
            </div>
          )}

          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={() => setStep("upload")}
              style={{ padding: "12px 24px", background: "#eee", border: "none", borderRadius: "4px", cursor: "pointer" }}>
              Back
            </button>
            <button onClick={commitToInventory} disabled={totalBatteries === 0}
              style={{ padding: "12px 24px", background: "#0c0", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", flex: 1 }}>
              Confirm &amp; Add {totalBatteries} to Inventory
            </button>
          </div>
        </div>
      )}

      {step === "committing" && (
        <div style={{ textAlign: "center", padding: "48px" }}>
          <p style={{ fontSize: "18px" }}>{commitProgress || "Working..."}</p>
          <p style={{ color: "#666" }}>Please don't close this page.</p>
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
