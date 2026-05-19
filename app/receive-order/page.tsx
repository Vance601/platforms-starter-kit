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

type LoggedBattery = {
  barcode: string;
  modelDisplay: string;
};

export default function ReceiveOrderPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [classifications, setClassifications] = useState<string[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [step, setStep] = useState<"invoice" | "scanning">("invoice");

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [locationId, setLocationId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [batteryCount, setBatteryCount] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);

  const [invoiceId, setInvoiceId] = useState("");
  const [expectedCount, setExpectedCount] = useState(0);
  const [loggedCount, setLoggedCount] = useState(0);
  const [selectedClassification, setSelectedClassification] = useState("");
  const [selectedModelCode, setSelectedModelCode] = useState("");
  const [scannedBatteries, setScannedBatteries] = useState<LoggedBattery[]>([]);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/receive-order/options")
      .then(r => r.json())
      .then(data => {
        setLocations(data.locations || []);
        setClassifications(data.classifications || []);
        setModels(data.models || []);
        if (data.classifications?.length > 0) {
          setSelectedClassification(data.classifications[0]);
        }
      })
      .catch(() => setError("Could not load locations, classifications, and models"));
  }, []);

  useEffect(() => {
    const firstModel = models.find(m => m.classification === selectedClassification);
    setSelectedModelCode(firstModel ? firstModel.code : "");
  }, [selectedClassification, models]);

  const filteredModels = models.filter(m => m.classification === selectedClassification);

  async function createInvoice() {
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/receive-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createInvoice",
          invoiceNumber, locationId,
          totalAmount: parseFloat(totalAmount),
          batteryCount: parseInt(batteryCount, 10),
          invoiceDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create invoice");
      setInvoiceId(data.invoiceId);
      setExpectedCount(data.expectedCount);
      setStep("scanning");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  async function addBattery() {
    setError("");
    if (!selectedModelCode) {
      setError("Please select a battery model");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/receive-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addBattery",
          invoiceId, batteryModelCode: selectedModelCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add battery");
      const modelDisplay = models.find(m => m.code === selectedModelCode)?.displayName || selectedModelCode;
      setScannedBatteries(prev => [{ barcode: data.barcode, modelDisplay }, ...prev]);
      setLoggedCount(data.loggedCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  async function finishInvoice() {
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/receive-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finishInvoice", invoiceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to finish invoice");
      alert(`Invoice ${data.status}. Expected ${data.expected}, logged ${data.actual}.`);
      window.location.href = "/batteries";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  const remaining = expectedCount - loggedCount;

  return (
    <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: "24px" }}>Receive Order</h1>

      {error && (
        <div style={{ background: "#fee", border: "1px solid #c00", padding: "12px", marginBottom: "16px", borderRadius: "4px" }}>
          {error}
        </div>
      )}

      {step === "invoice" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <label>
            MBS Invoice Number
            <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
              style={{ display: "block", width: "100%", padding: "8px", marginTop: "4px" }} />
          </label>
          <label>
            Location
            <select value={locationId} onChange={e => setLocationId(e.target.value)}
              style={{ display: "block", width: "100%", padding: "8px", marginTop: "4px" }}>
              <option value="">-- Select location --</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.companyName} — {loc.name}</option>
              ))}
            </select>
          </label>
          <label>
            Invoice Date
            <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
              style={{ display: "block", width: "100%", padding: "8px", marginTop: "4px" }} />
          </label>
          <label>
            Total Amount ($)
            <input type="number" step="0.01" value={totalAmount} onChange={e => setTotalAmount(e.target.value)}
              style={{ display: "block", width: "100%", padding: "8px", marginTop: "4px" }} />
          </label>
          <label>
            Expected Battery Count
            <input type="number" value={batteryCount} onChange={e => setBatteryCount(e.target.value)}
              style={{ display: "block", width: "100%", padding: "8px", marginTop: "4px" }} />
          </label>
          <button onClick={createInvoice} disabled={isLoading || !invoiceNumber || !locationId || !totalAmount || !batteryCount}
            style={{ padding: "12px", background: "#0066cc", color: "white", border: "none", borderRadius: "4px", marginTop: "8px", cursor: "pointer" }}>
            {isLoading ? "Creating..." : "Start Receiving"}
          </button>
        </div>
      )}

      {step === "scanning" && (
        <div>
          <div style={{ background: "#f0f0f0", padding: "16px", marginBottom: "16px", borderRadius: "4px" }}>
            <strong>Invoice:</strong> {invoiceNumber}<br />
            <strong>Expected:</strong> {expectedCount} &nbsp;
            <strong>Logged:</strong> {loggedCount} &nbsp;
            <strong>Remaining:</strong> {remaining}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
            <label>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Classification</div>
              <select value={selectedClassification} onChange={e => setSelectedClassification(e.target.value)}
                style={{ width: "100%", padding: "8px" }}>
                {classifications.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Model</div>
              <select value={selectedModelCode} onChange={e => setSelectedModelCode(e.target.value)}
                style={{ width: "100%", padding: "8px" }}>
                {filteredModels.map(m => (
                  <option key={m.code} value={m.code}>{m.displayName}</option>
                ))}
              </select>
            </label>
          </div>

          <button onClick={addBattery} disabled={isLoading || !selectedModelCode}
            style={{ padding: "12px 24px", width: "100%", background: "#0c0", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", marginBottom: "12px" }}>
            {isLoading ? "Adding..." : "+ Add Battery"}
          </button>

          <button onClick={finishInvoice} disabled={isLoading}
            style={{ padding: "12px 24px", width: "100%", background: "#666", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", marginBottom: "16px" }}>
            Finish Receiving
          </button>

          <h3>Recently Logged ({scannedBatteries.length}):</h3>
          <ul style={{ fontFamily: "monospace", fontSize: "14px", listStyle: "none", padding: 0 }}>
            {scannedBatteries.map(b => (
              <li key={b.barcode} style={{ padding: "6px 0", borderBottom: "1px solid #eee" }}>
                <strong>{b.barcode}</strong>
                <span style={{ marginLeft: "12px", color: "#666", fontFamily: "system-ui, sans-serif" }}>{b.modelDisplay}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
