"use client";

import { useState, useEffect } from "react";

type Battery = {
  id: string;
  barcode: string;
  status: string;
  cost: string;
  receivedAt: string;
  classification: string;
  model: string | null;
  modelDisplay: string | null;
  locationName: string;
  locationSlug: string;
  companyName: string;
  companySlug: string;
  truckId: string | null;
  truckNumber: string | null;
  truckDriverName: string | null;
  sourceInvoice: string | null;
};

type TruckSummary = {
  id: string;
  truckNumber: string;
  driverName: string | null;
  companyName: string;
  count: number;
};

type StatusSummary = { status: string; count: number };

type LocationSummary = {
  id: string;
  locationName: string;
  locationSlug: string;
  companyName: string;
  count: number;
};

type ClassificationSummary = {
  classification: string;
  count: number;
};

export default function BatteriesPage() {
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [byLocation, setByLocation] = useState<LocationSummary[]>([]);
  const [byClassification, setByClassification] = useState<ClassificationSummary[]>([]);
  const [byTruck, setByTruck] = useState<TruckSummary[]>([]);
  const [byStatus, setByStatus] = useState<StatusSummary[]>([]);
  // Every unit in the org, live or historical - used only for the footnote.
  const [allCount, setAllCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [locationFilter, setLocationFilter] = useState("");
  const [classificationFilter, setClassificationFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchBarcode, setSearchBarcode] = useState("");
  const [truckFilter, setTruckFilter] = useState("");

  useEffect(() => {
    fetch("/api/batteries")
      .then(r => r.json())
      .then(data => {
        // This page is live inventory only: what is in a warehouse or on a
        // truck right now. Sold units, returned cores, customer-kept cores and
        // warranty units are history - they live on Battery Audit (/reconcile),
        // which already tracks sold_at, call numbers and warranty flags.
        const LIVE = new Set(["in_warehouse", "on_truck"]);
        const all: Battery[] = data.batteries || [];
        setBatteries(all.filter(b => LIVE.has(b.status)));
        setAllCount(all.length);
        setByLocation(data.byLocation || []);
        setByClassification(data.byClassification || []);
        setByTruck(data.byTruck || []);
        setByStatus(data.byStatus || []);
        setIsLoading(false);
      })
      .catch(() => {
        setError("Could not load batteries");
        setIsLoading(false);
      });
  }, []);

  const uniqueModels = Array.from(new Set(batteries.map(b => b.model).filter(Boolean))) as string[];
  uniqueModels.sort();

  // Print QR labels for whatever is currently filtered. Previously labels could
  // only be printed at the moment of receiving, so a lost or damaged label meant
  // the battery could never be relabelled.
  function printLabels() {
    const rows = filteredBatteries;
    if (rows.length === 0) return;

    const cells = rows
      .map(b => {
        const url =
          "https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=" +
          encodeURIComponent(b.barcode);
        const model = (b.modelDisplay || b.model || "").toString();
        return `
          <div class="label">
            <img src="${url}" alt="" />
            <div class="text">
              <div class="bc">${b.barcode}</div>
              <div class="md">${model ? "Model " + model : ""}</div>
            </div>
          </div>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html><head><title>Battery Labels</title>
<style>
  @page { size: 2in 1in; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, Segoe UI, Arial, sans-serif; }
  .label {
    width: 2in; height: 1in; padding: 0.06in;
    display: flex; align-items: center; gap: 0.06in;
    page-break-after: always; break-after: page; overflow: hidden;
  }
  .label img { width: 0.85in; height: 0.85in; }
  .text { flex: 1; min-width: 0; }
  .bc { font-family: monospace; font-size: 7.5pt; word-break: break-all; line-height: 1.15; }
  .md { font-size: 7pt; color: #333; margin-top: 2px; }
  @media screen {
    body { background: #f3f4f6; padding: 12px; }
    .label { background: #fff; border: 1px solid #ccc; margin-bottom: 8px; }
  }
</style></head>
<body>${cells}</body></html>`;

    const w = window.open("", "_blank");
    if (!w) {
      alert("Allow pop-ups for this site to print labels.");
      return;
    }
    w.document.write(html);
    w.document.close();
    // Give the QR images a moment to load before the print dialog opens.
    setTimeout(() => w.print(), 900);
  }

  const filteredBatteries = batteries.filter(b => {
    if (locationFilter && b.locationSlug !== locationFilter) return false;
    if (classificationFilter && b.classification !== classificationFilter) return false;
    if (modelFilter && b.model !== modelFilter) return false;
    if (statusFilter && b.status !== statusFilter) return false;
    if (truckFilter && b.truckId !== truckFilter) return false;
    if (searchBarcode && !b.barcode.toLowerCase().includes(searchBarcode.toLowerCase())) return false;
    return true;
  });

  function formatDate(iso: string): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  function daysIn(iso: string): string {
    if (!iso) return "—";
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return `${days} d`;
  }

  function statusBadge(status: string) {
    const label = status.replace(/_/g, " ").toUpperCase();
    const colors: Record<string, { bg: string; text: string }> = {
      in_warehouse: { bg: "#0c0", text: "white" },
      assigned: { bg: "#fc0", text: "black" },
      sold: { bg: "#888", text: "white" },
      core_returned: { bg: "#06c", text: "white" },
    };
    const style = colors[status] || { bg: "#ccc", text: "black" };
    return (
      <span style={{ background: style.bg, color: style.text, padding: "4px 10px", borderRadius: "4px", fontSize: "11px", fontWeight: 600 }}>
        {label}
      </span>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ margin: 0 }}>Battery Inventory</h1>
        <a href="/receive-order" style={{ padding: "10px 16px", background: "#06c", color: "white", textDecoration: "none", borderRadius: "4px", fontSize: "14px" }}>
          + Receive Order
        </a>
      </div>

      {error && (
        <div style={{ background: "#fee", border: "1px solid #c00", padding: "12px", marginBottom: "16px", borderRadius: "4px" }}>
          {error}
        </div>
      )}

      <h3 style={{ marginTop: "16px", marginBottom: "12px", fontWeight: 500, fontSize: "16px" }}>By Location</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        {byLocation.map(loc => (
          <div key={loc.id} style={{ padding: "16px", border: "1px solid #ddd", borderRadius: "4px", background: "#fafafa" }}>
            <div style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>{loc.locationName}</div>
            <div style={{ fontSize: "28px", fontWeight: 600 }}>{loc.count}</div>
            <div style={{ fontSize: "12px", color: "#999" }}>batteries</div>
          </div>
        ))}
      </div>

      <h3 style={{ marginTop: "16px", marginBottom: "12px", fontWeight: 500, fontSize: "16px" }}>
        On Trucks
        {truckFilter && (
          <button
            onClick={() => setTruckFilter("")}
            style={{ marginLeft: 12, fontSize: 12, fontWeight: 400, padding: "4px 10px", border: "1px solid #ccc", borderRadius: 4, background: "#fff", cursor: "pointer" }}
          >
            Clear truck filter
          </button>
        )}
      </h3>
      {byTruck.filter(t => t.count > 0).length === 0 ? (
        <div style={{ padding: "16px", border: "1px dashed #ddd", borderRadius: 4, color: "#888", fontSize: 13, marginBottom: 24 }}>
          No batteries are on trucks right now.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px", marginBottom: "24px" }}>
          {byTruck.filter(t => t.count > 0).map(t => {
            const active = truckFilter === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setTruckFilter(active ? "" : t.id)}
                style={{
                  padding: "16px",
                  border: active ? "2px solid #2563eb" : "1px solid #ddd",
                  borderRadius: "4px",
                  background: active ? "#eff6ff" : "#fafafa",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>
                  Truck #{t.truckNumber}
                </div>
                <div style={{ fontSize: "28px", fontWeight: 600 }}>{t.count}</div>
                <div style={{ fontSize: "12px", color: "#999" }}>
                  {t.driverName || "Unassigned"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {byStatus.length > 0 && (() => {
        const LIVE = new Set(["in_warehouse", "on_truck"]);
        const live = byStatus.filter(s2 => LIVE.has(s2.status));
        const history = byStatus.filter(s2 => !LIVE.has(s2.status));
        const historyTotal = history.reduce((n, s2) => n + s2.count, 0);
        return (
          <div style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>
            <div>
              {live.map(s2 => `${s2.count} ${s2.status.replace(/_/g, " ")}`).join("  ·  ")}
              {live.length > 0 ? `  ·  ${batteries.length} total in stock` : null}
            </div>
            {historyTotal > 0 && (
              <div style={{ marginTop: 4, color: "#888" }}>
                {historyTotal} sold or core record{historyTotal === 1 ? "" : "s"} not shown here (
                {history.map(s2 => `${s2.count} ${s2.status.replace(/_/g, " ")}`).join(", ")}
                ) —{" "}
                <a href="/reconcile" style={{ color: "#2563eb" }}>
                  Battery Audit
                </a>
              </div>
            )}
          </div>
        );
      })()}

      <h3 style={{ marginTop: "16px", marginBottom: "12px", fontWeight: 500, fontSize: "16px" }}>By Classification</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        {byClassification.map(c => (
          <div key={c.classification} style={{ padding: "16px", border: "1px solid #ddd", borderRadius: "4px", background: "#fafafa" }}>
            <div style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>{c.classification} Batteries</div>
            <div style={{ fontSize: "28px", fontWeight: 600 }}>{c.count}</div>
            <div style={{ fontSize: "12px", color: "#999" }}>in stock</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "16px" }}>
        <div>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Location</div>
          <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
            style={{ width: "100%", padding: "8px" }}>
            <option value="">All Locations</option>
            {byLocation.map(loc => (
              <option key={loc.id} value={loc.locationSlug}>{loc.locationName}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Classification</div>
          <select value={classificationFilter} onChange={e => setClassificationFilter(e.target.value)}
            style={{ width: "100%", padding: "8px" }}>
            <option value="">All Classifications</option>
            {byClassification.map(c => (
              <option key={c.classification} value={c.classification}>{c.classification}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Model</div>
          <select value={modelFilter} onChange={e => setModelFilter(e.target.value)}
            style={{ width: "100%", padding: "8px" }}>
            <option value="">All Models</option>
            {uniqueModels.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Status</div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ width: "100%", padding: "8px" }}>
            <option value="">All Statuses</option>
            <option value="in_warehouse">In Warehouse</option>
            <option value="assigned">Assigned</option>
            <option value="sold">Sold</option>
            <option value="core_returned">Core Returned</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Search Barcode</div>
          <input type="text" value={searchBarcode} onChange={e => setSearchBarcode(e.target.value)}
            placeholder="DG-PHX-..." style={{ width: "100%", padding: "8px", boxSizing: "border-box" }} />
        </div>
      </div>

      <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: "13px", color: "#666" }}>
          {isLoading ? "Loading..." : `Showing ${filteredBatteries.length} of ${batteries.length} in stock`}
        </div>
        <button
          onClick={printLabels}
          disabled={filteredBatteries.length === 0}
          style={{
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 4,
            border: "1px solid #2563eb",
            background: filteredBatteries.length === 0 ? "#eee" : "#2563eb",
            color: filteredBatteries.length === 0 ? "#999" : "#fff",
            cursor: filteredBatteries.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          Print {filteredBatteries.length} label{filteredBatteries.length === 1 ? "" : "s"}
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
        <thead>
          <tr style={{ background: "#f5f5f5", borderBottom: "2px solid #ddd" }}>
            <th style={{ padding: "12px 8px", textAlign: "left" }}>Barcode</th>
            <th style={{ padding: "12px 8px", textAlign: "left" }}>Classification</th>
            <th style={{ padding: "12px 8px", textAlign: "left" }}>Model</th>
            <th style={{ padding: "12px 8px", textAlign: "left" }}>Location</th>
            <th style={{ padding: "12px 8px", textAlign: "left" }}>Truck</th>
            <th style={{ padding: "12px 8px", textAlign: "left" }}>Status</th>
            <th style={{ padding: "12px 8px", textAlign: "right" }}>Cost</th>
            <th style={{ padding: "12px 8px", textAlign: "left" }}>Received</th>
            <th style={{ padding: "12px 8px", textAlign: "left" }}>Days In</th>
            <th style={{ padding: "12px 8px", textAlign: "left" }}>Source Invoice</th>
          </tr>
        </thead>
        <tbody>
          {filteredBatteries.map(b => (
            <tr key={b.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "12px 8px", fontFamily: "monospace", fontSize: "13px" }}>{b.barcode}</td>
              <td style={{ padding: "12px 8px" }}>{b.classification}</td>
              <td style={{ padding: "12px 8px", fontWeight: 500 }}>{b.modelDisplay || "—"}</td>
              <td style={{ padding: "12px 8px" }}>
                <div>{b.locationName}</div>
                <div style={{ fontSize: "12px", color: "#888" }}>{b.companyName}</div>
              </td>
              <td style={{ padding: "12px 8px" }}>
                {b.truckNumber ? (
                  <>
                    <div style={{ fontWeight: 500 }}>#{b.truckNumber}</div>
                    {b.truckDriverName ? (
                      <div style={{ fontSize: "12px", color: "#888" }}>{b.truckDriverName}</div>
                    ) : null}
                  </>
                ) : (
                  <span style={{ color: "#ccc" }}>—</span>
                )}
              </td>
              <td style={{ padding: "12px 8px" }}>{statusBadge(b.status)}</td>
              <td style={{ padding: "12px 8px", textAlign: "right" }}>${parseFloat(b.cost).toFixed(2)}</td>
              <td style={{ padding: "12px 8px" }}>{formatDate(b.receivedAt)}</td>
              <td style={{ padding: "12px 8px" }}>{daysIn(b.receivedAt)}</td>
              <td style={{ padding: "12px 8px", fontFamily: "monospace", fontSize: "13px" }}>{b.sourceInvoice || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!isLoading && filteredBatteries.length === 0 && (
        <div style={{ padding: "32px", textAlign: "center", color: "#888" }}>
          No batteries match your filters
        </div>
      )}
    </div>
  );
}
