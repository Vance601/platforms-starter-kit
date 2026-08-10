"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";

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

  // Labels are rendered in a hidden block on this page and revealed by the
  // print stylesheet. The previous version opened a new window and pulled one
  // QR image per battery from an external service - 94 network requests at
  // once locked the browser up. QR codes are now generated locally with
  // qrcode.react, so printing does no network work at all.
  //
  // The old sheet also set page-break-after on every label, which is why each
  // one came out on its own page. They now tile across letter sheets.
  const [labelCols, setLabelCols] = useState(3);

  function printLabels() {
    if (filteredBatteries.length === 0) return;
    window.print();
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
        <label style={{ fontSize: 12, color: "#666", display: "flex", alignItems: "center", gap: 6 }}>
          per row
          <select
            value={labelCols}
            onChange={e => setLabelCols(Number(e.target.value))}
            style={{ padding: "4px 6px", fontSize: 12 }}
          >
            <option value={3}>3 (0.5in margins)</option>
            <option value={4}>4 (edge to edge)</option>
          </select>
        </label>
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

      {/* Hidden on screen, shown only by the print stylesheet. */}
      <style>{`
        @media print {
          @page { size: letter; margin: ${labelCols === 3 ? "0.5in" : "0"}; }
          body * { visibility: hidden !important; }
          #label-sheet, #label-sheet * { visibility: visible !important; }
          #label-sheet {
            display: grid !important;
            grid-template-columns: repeat(${labelCols}, 2in);
            position: absolute; left: 0; top: 0;
          }
        }
      `}</style>

      <div
        id="label-sheet"
        style={{ display: "none", gridTemplateColumns: `repeat(${labelCols}, 2in)` }}
      >
        {filteredBatteries.map(b => (
          <div
            key={`lbl-${b.id}`}
            style={{
              width: "2in",
              height: "1in",
              padding: "0.05in",
              display: "flex",
              alignItems: "center",
              gap: "0.06in",
              overflow: "hidden",
              boxSizing: "border-box",
            }}
          >
            <QRCodeSVG value={b.barcode} size={82} level="M" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "7.5pt",
                  lineHeight: 1.15,
                  wordBreak: "break-all",
                }}
              >
                {b.barcode}
              </div>
              <div style={{ fontSize: "7pt", color: "#333", marginTop: 2 }}>
                {b.modelDisplay || b.model || ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
