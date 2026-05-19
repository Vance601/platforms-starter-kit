"use client";

import { useState, useEffect } from "react";

type Battery = {
  id: string;
  barcode: string;
  type: string;
  status: string;
  cost: string | null;
  receivedAt: string;
  locationId: string;
  locationName: string;
  companyName: string;
  sourceInvoice: string | null;
};

const LOCATIONS = ["ABQ Main", "Camelback", "Elwood", "Tucson Main"];
const TYPES = ["Alpha", "Bravo", "Charlie", "AMG"];
const STATUSES = ["in_warehouse", "assigned", "sold"];

export default function BatteriesPage() {
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filterLocation, setFilterLocation] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/batteries")
      .then(r => r.json())
      .then(data => {
        setBatteries(data.batteries || []);
        setLoading(false);
      })
      .catch(e => {
        setError(e instanceof Error ? e.message : "Failed to load batteries");
        setLoading(false);
      });
  }, []);

  const filtered = batteries.filter(b => {
    if (filterLocation !== "All" && b.locationName !== filterLocation) return false;
    if (filterType !== "All" && b.type !== filterType) return false;
    if (filterStatus !== "All" && b.status !== filterStatus) return false;
    if (search && !b.barcode.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const countByLocation = (name: string) => batteries.filter(b => b.locationName === name).length;
  const countByType = (code: string) => batteries.filter(b => b.type === code).length;

  function daysInInventory(receivedAt: string): number {
    const received = new Date(receivedAt).getTime();
    const now = Date.now();
    return Math.floor((now - received) / (1000 * 60 * 60 * 24));
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function statusBadgeColor(status: string): string {
    if (status === "in_warehouse") return "#059669";
    if (status === "assigned") return "#d97706";
    if (status === "sold") return "#6b7280";
    return "#374151";
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ margin: 0 }}>Battery Inventory</h1>
        <a href="/receive-order"
          style={{ padding: "10px 16px", background: "#0066cc", color: "white", textDecoration: "none", borderRadius: "4px" }}>
          + Receive Order
        </a>
      </div>

      {error && (
        <div style={{ background: "#fee", border: "1px solid #c00", padding: "12px", marginBottom: "16px", borderRadius: "4px" }}>
          {error}
        </div>
      )}

      {loading && <p>Loading batteries...</p>}

      {!loading && (
        <>
          <h3 style={{ marginTop: "0", marginBottom: "12px", color: "#374151" }}>By Location</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
            {LOCATIONS.map(loc => (
              <div key={loc} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", padding: "16px", borderRadius: "8px" }}>
                <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>{loc}</div>
                <div style={{ fontSize: "28px", fontWeight: "bold" }}>{countByLocation(loc)}</div>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>batteries</div>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: "0", marginBottom: "12px", color: "#374151" }}>By Type</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
            {TYPES.map(t => (
              <div key={t} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", padding: "16px", borderRadius: "8px" }}>
                <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>{t} Batteries</div>
                <div style={{ fontSize: "28px", fontWeight: "bold" }}>{countByType(t)}</div>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>in stock</div>
              </div>
            ))}
          </div>

          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", padding: "16px", borderRadius: "8px", marginBottom: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr", gap: "12px", alignItems: "end" }}>
              <label>
                <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Location</div>
                <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)}
                  style={{ width: "100%", padding: "8px" }}>
                  <option value="All">All Locations</option>
                  {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
              <label>
                <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Type</div>
                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                  style={{ width: "100%", padding: "8px" }}>
                  <option value="All">All Types</option>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label>
                <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Status</div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  style={{ width: "100%", padding: "8px" }}>
                  <option value="All">All Statuses</option>
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </label>
              <label>
                <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Search Barcode</div>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="DG-PHX-A-..."
                  style={{ width: "100%", padding: "8px", boxSizing: "border-box" }} />
              </label>
            </div>
            <div style={{ marginTop: "12px", fontSize: "13px", color: "#6b7280" }}>
              Showing {filtered.length} of {batteries.length} batteries
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                  <th style={{ padding: "12px 8px", borderBottom: "2px solid #e5e7eb" }}>Barcode</th>
                  <th style={{ padding: "12px 8px", borderBottom: "2px solid #e5e7eb" }}>Type</th>
                  <th style={{ padding: "12px 8px", borderBottom: "2px solid #e5e7eb" }}>Location</th>
                  <th style={{ padding: "12px 8px", borderBottom: "2px solid #e5e7eb" }}>Status</th>
                  <th style={{ padding: "12px 8px", borderBottom: "2px solid #e5e7eb" }}>Cost</th>
                  <th style={{ padding: "12px 8px", borderBottom: "2px solid #e5e7eb" }}>Received</th>
                  <th style={{ padding: "12px 8px", borderBottom: "2px solid #e5e7eb" }}>Days In</th>
                  <th style={{ padding: "12px 8px", borderBottom: "2px solid #e5e7eb" }}>Source Invoice</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: "24px", textAlign: "center", color: "#6b7280" }}>
                      No batteries match these filters.
                    </td>
                  </tr>
                )}
                {filtered.map(b => (
                  <tr key={b.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: "13px" }}>{b.barcode}</td>
                    <td style={{ padding: "10px 8px" }}>{b.type}</td>
                    <td style={{ padding: "10px 8px" }}>
                      <div>{b.locationName}</div>
                      <div style={{ fontSize: "11px", color: "#6b7280" }}>{b.companyName}</div>
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <span style={{
                        background: statusBadgeColor(b.status),
                        color: "white",
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                      }}>
                        {b.status.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ padding: "10px 8px" }}>{b.cost ? `$${b.cost}` : "—"}</td>
                    <td style={{ padding: "10px 8px" }}>{formatDate(b.receivedAt)}</td>
                    <td style={{ padding: "10px 8px" }}>{daysInInventory(b.receivedAt)} d</td>
                    <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: "12px" }}>
                      {b.sourceInvoice || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
