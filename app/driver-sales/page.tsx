"use client";

import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import { addDaysYmd, DEFAULT_BUSINESS_TIMEZONE, todayYmd } from "@/lib/org-day-range";

type SaleRow = {
  driver_id: string;
  driver_name: string;
  units_sold: number;
  warranties: number;
};
type TypeRow = {
  driver_id: string;
  type_name: string;
  count: number;
};
type CoreRow = {
  driver_id: string;
  cores_returned: number;
};
type SaleDetail = {
  driver_id: string;
  driver_name: string;
  sold_at: string | null;
  battery_group: string | null;
  barcode: string | null;
  serial_number: string | null;
  quickbooks_invoice_id: string | null;
  call_number: string | null;
  customer: string | null;
  is_warranty: boolean;
  sale_amount: string | number | null;
  cost: string | number | null;
  core_status: string | null;
  truck_number: string | null;
  battery_id?: string | null;
  movement_id?: string | null;
  logged_by_name?: string | null;
};
type ApiResponse = {
  success: boolean;
  error?: string;
  range?: { start: string; end: string };
  salesByDriver?: SaleRow[];
  typeByDriver?: TypeRow[];
  coresByDriver?: CoreRow[];
  salesDetail?: SaleDetail[];
};

type MergedRow = {
  driverId: string;
  driverName: string;
  unitsSold: number;
  warranties: number;
  paid: number;
  coresReturned: number;
  types: { name: string; count: number }[];
  details: SaleDetail[];
};

function defaultStart(): string {
  return addDaysYmd(todayYmd(DEFAULT_BUSINESS_TIMEZONE), -30);
}
function defaultEnd(): string {
  return todayYmd(DEFAULT_BUSINESS_TIMEZONE);
}

function money(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function coreLabel(status: string | null | undefined): string {
  if (!status || status === "owed") return "Owed";
  if (status === "returned") return "Returned";
  if (status === "customer_kept") return "Customer kept";
  return status;
}

function invoiceLabel(d: SaleDetail): string {
  const parts: string[] = [];
  if (d.quickbooks_invoice_id) parts.push(`QB ${d.quickbooks_invoice_id}`);
  if (d.call_number) parts.push(`Towbook #${d.call_number}`);
  return parts.join(" · ") || "—";
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export default function DriverSalesPage() {
  const [start, setStart] = useState(defaultStart());
  const [end, setEnd] = useState(defaultEnd());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<MergedRow[]>([]);
  const [loadedRange, setLoadedRange] = useState<{ start: string; end: string } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([]);
  const [reassignKey, setReassignKey] = useState<string | null>(null);
  const [reassignDriverId, setReassignDriverId] = useState("");
  const [reassignNote, setReassignNote] = useState("");
  const [reassignBusy, setReassignBusy] = useState(false);
  const [reassignMsg, setReassignMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/drivers", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) {
          setDrivers((d.drivers || []).filter((x: { active?: boolean }) => x.active !== false).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
        }
      })
      .catch(() => {});
  }, []);

  async function reassignSeller(d: SaleDetail) {
    if (!reassignDriverId) {
      setReassignMsg("Pick the driver who should get credit.");
      return;
    }
    setReassignBusy(true);
    setReassignMsg("");
    try {
      const res = await fetch("/api/sales/reassign-seller", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batteryId: d.battery_id,
          movementId: d.movement_id,
          newDriverId: reassignDriverId,
          note: reassignNote.trim(),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setReassignMsg(data.error || "Could not reassign that sale.");
      } else {
        setReassignMsg(data.message || "Seller updated.");
        setReassignKey(null);
        setReassignDriverId("");
        setReassignNote("");
        await load();
      }
    } catch {
      setReassignMsg("Network error");
    } finally {
      setReassignBusy(false);
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/driver-sales?start=${start}&end=${end}`
      );
      const data: ApiResponse = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 401) {
          setError("Not signed in.");
        } else {
          setError(data.error || "Could not load report.");
        }
        setLoading(false);
        return;
      }

      const map = new Map<string, MergedRow>();

      for (const s of data.salesByDriver || []) {
        map.set(s.driver_id, {
          driverId: s.driver_id,
          driverName: s.driver_name,
          unitsSold: s.units_sold,
          warranties: s.warranties,
          paid: s.units_sold - s.warranties,
          coresReturned: 0,
          types: [],
          details: [],
        });
      }
      for (const t of data.typeByDriver || []) {
        const row = map.get(t.driver_id);
        if (row) {
          row.types.push({ name: t.type_name, count: t.count });
        }
      }
      for (const c of data.coresByDriver || []) {
        let row = map.get(c.driver_id);
        if (!row) {
          row = {
            driverId: c.driver_id,
            driverName: "(driver)",
            unitsSold: 0,
            warranties: 0,
            paid: 0,
            coresReturned: 0,
            types: [],
            details: [],
          };
          map.set(c.driver_id, row);
        }
        row.coresReturned = c.cores_returned;
      }
      for (const d of data.salesDetail || []) {
        let row = map.get(d.driver_id);
        if (!row) {
          row = {
            driverId: d.driver_id,
            driverName: d.driver_name || "(driver)",
            unitsSold: 0,
            warranties: 0,
            paid: 0,
            coresReturned: 0,
            types: [],
            details: [],
          };
          map.set(d.driver_id, row);
        }
        row.details.push(d);
      }

      const merged = Array.from(map.values()).sort(
        (a, b) => b.unitsSold - a.unitsSold || a.driverName.localeCompare(b.driverName)
      );

      setRows(merged);
      setLoadedRange(data.range ? { start: data.range.start, end: data.range.end } : null);
    } catch {
      setError("Network error - try again.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function exportCSV(detailed: boolean) {
    if (rows.length === 0) return;
    let text = "";
    if (detailed) {
      const header = [
        "Date",
        "Driver",
        "Truck",
        "Battery group",
        "Battery ID",
        "Serial",
        "QuickBooks invoice",
        "Towbook call #",
        "Customer",
        "Type",
        "Sale amount",
        "Cost (wholesale)",
        "Core status",
      ].join(",") + "\n";
      const body = rows
        .flatMap((r) =>
          r.details.map((d) =>
            [
              csvCell(d.sold_at ? String(d.sold_at).slice(0, 10) : ""),
              csvCell(r.driverName),
              csvCell(d.truck_number ? `#${d.truck_number}` : ""),
              csvCell(d.battery_group),
              csvCell(d.barcode),
              csvCell(d.serial_number),
              csvCell(d.quickbooks_invoice_id),
              csvCell(d.call_number),
              csvCell(d.customer),
              csvCell(d.is_warranty ? "Warranty" : "Paid"),
              csvCell(d.sale_amount ?? ""),
              csvCell(d.cost ?? ""),
              csvCell(coreLabel(d.core_status)),
            ].join(",")
          )
        )
        .join("\n");
      text = header + body + (body ? "\n" : "");
    } else {
      const header = "Driver,Units Sold,Paid Sales,Warranties,Cores Returned,Type Breakdown\n";
      const body = rows
        .map((r) => {
          const types = r.types.map((t) => `${t.name}:${t.count}`).join(" ");
          return [
            csvCell(r.driverName),
            r.unitsSold,
            r.paid,
            r.warranties,
            r.coresReturned,
            csvCell(types),
          ].join(",");
        })
        .join("\n");
      const totalUnits = rows.reduce((s, r) => s + r.unitsSold, 0);
      const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
      const totalWarr = rows.reduce((s, r) => s + r.warranties, 0);
      const totalCores = rows.reduce((s, r) => s + r.coresReturned, 0);
      const totalRow = `"TOTAL",${totalUnits},${totalPaid},${totalWarr},${totalCores},""`;
      text = header + body + "\n" + totalRow;
    }

    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      detailed ? `driver-sales-detail-${start}-to-${end}.csv` : `driver-sales-${start}-to-${end}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const page: React.CSSProperties = {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "24px 16px",
    fontFamily: "system-ui, sans-serif",
  };
  const card: React.CSSProperties = {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    background: "#fff",
  };
  const backLink: React.CSSProperties = {
    display: "inline-block",
    marginBottom: 16,
    fontSize: 14,
    color: "#2563eb",
    textDecoration: "none",
  };
  const label: React.CSSProperties = { fontSize: 13, color: "#475569", display: "block", marginBottom: 4 };
  const input: React.CSSProperties = {
    padding: "8px 10px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 14,
  };
  const btn: React.CSSProperties = {
    padding: "9px 16px",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontSize: 14,
    cursor: "pointer",
  };
  const btnOutline: React.CSSProperties = {
    padding: "9px 16px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontSize: 14,
    cursor: "pointer",
  };
  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "10px 12px",
    borderBottom: "2px solid #e2e8f0",
    fontSize: 13,
    color: "#475569",
  };
  const td: React.CSSProperties = {
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 14,
  };

  const totalUnits = rows.reduce((s, r) => s + r.unitsSold, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const totalWarr = rows.reduce((s, r) => s + r.warranties, 0);
  const totalCores = rows.reduce((s, r) => s + r.coresReturned, 0);

  return (
    <div style={page}>
      <Link href="/" style={backLink}>Back to Dashboard</Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Driver Sales Report</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={btnOutline} onClick={() => exportCSV(false)} disabled={rows.length === 0}>
            Export CSV
          </button>
          <button style={btnOutline} onClick={() => exportCSV(true)} disabled={!rows.some((r) => r.details.length)}>
            Export detailed CSV
          </button>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={label}>Start date</label>
            <input style={input} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label style={label}>End date</label>
            <input style={input} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <button style={btn} onClick={() => load()} disabled={loading}>
            {loading ? "Loading…" : "Apply"}
          </button>
        </div>
        {loadedRange && (
          <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 10 }}>
            Showing {loadedRange.start.split("T")[0]} to {loadedRange.end.split("T")[0]}. Counts include
            paid and warranty sales; the Warranties column shows how many of Units Sold were warranties.
            Click a driver to see each sale.
          </p>
        )}
        {error && <div style={{ color: "#dc2626", marginTop: 10, fontSize: 14 }}>{error}</div>}
      </div>

      <div style={card}>
        {loading && rows.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 14 }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 14 }}>No driver activity in this date range.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}></th>
                  <th style={th}>Driver</th>
                  <th style={th}>Units Sold</th>
                  <th style={th}>Paid</th>
                  <th style={th}>Warranties</th>
                  <th style={th}>Cores Returned</th>
                  <th style={th}>Type Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const open = !!expanded[r.driverId];
                  return (
                    <Fragment key={r.driverId}>
                      <tr
                        key={r.driverId}
                        onClick={() => setExpanded((prev) => ({ ...prev, [r.driverId]: !prev[r.driverId] }))}
                        style={{ cursor: "pointer" }}
                      >
                        <td style={{ ...td, width: 28, color: "#64748b" }}>{open ? "▼" : "▶"}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{r.driverName}</td>
                        <td style={td}>{r.unitsSold}</td>
                        <td style={td}>{r.paid}</td>
                        <td style={td}>{r.warranties}</td>
                        <td style={td}>{r.coresReturned}</td>
                        <td style={td}>
                          {r.types.length === 0
                            ? "-"
                            : r.types.map((t) => `${t.name}: ${t.count}`).join(", ")}
                        </td>
                      </tr>
                      {open ? (
                        <tr key={`${r.driverId}-detail`}>
                          <td colSpan={7} style={{ ...td, background: "#f8fafc", padding: 0 }}>
                            {r.details.length === 0 ? (
                              <p style={{ margin: 0, padding: "12px 16px", fontSize: 13, color: "#64748b" }}>
                                No individual sales in this range.
                              </p>
                            ) : (
                              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                  <tr>
                                    <th style={th}>Date</th>
                                    <th style={th}>Battery group</th>
                                    <th style={th}>Battery ID</th>
                                    <th style={th}>Invoice / call #</th>
                                    <th style={th}>Customer</th>
                                    <th style={th}>Type</th>
                                    <th style={th}>Amount</th>
                                    <th style={th}>Core</th>
                                    <th style={th}>Logged by</th>
                                    <th style={th}></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.details.map((d, i) => (
                                    <tr key={`${d.barcode || i}-${d.sold_at || i}`}>
                                      <td style={td}>{d.sold_at ? String(d.sold_at).slice(0, 10) : "—"}</td>
                                      <td style={td}>{d.battery_group || "—"}</td>
                                      <td style={{ ...td, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>
                                        {d.barcode || "—"}
                                        {d.serial_number ? <div style={{ color: "#64748b" }}>SN {d.serial_number}</div> : null}
                                        {d.truck_number ? <div style={{ color: "#64748b" }}>Truck #{d.truck_number}</div> : null}
                                      </td>
                                      <td style={td}>{invoiceLabel(d)}</td>
                                      <td style={td}>{d.customer || "—"}</td>
                                      <td style={td}>{d.is_warranty ? "Warranty" : "Paid"}</td>
                                      <td style={td}>
                                        {d.sale_amount != null && d.sale_amount !== ""
                                          ? money(d.sale_amount)
                                          : d.cost != null && d.cost !== ""
                                          ? `${money(d.cost)} cost`
                                          : "—"}
                                      </td>
                                      <td style={td}>{coreLabel(d.core_status)}</td>
                                      <td style={td}>{d.logged_by_name || "—"}</td>
                                      <td style={td}>
                                        {d.battery_id || d.movement_id ? (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const key = `${d.movement_id || ""}:${d.barcode || i}`;
                                              setReassignKey(reassignKey === key ? null : key);
                                              setReassignDriverId("");
                                              setReassignNote("");
                                              setReassignMsg("");
                                            }}
                                            style={{ background: "#e2e8f0", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 12 }}
                                          >
                                            Reassign seller
                                          </button>
                                        ) : null}
                                        {reassignKey === `${d.movement_id || ""}:${d.barcode || i}` ? (
                                          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
                                            <select
                                              aria-label="New selling driver"
                                              value={reassignDriverId}
                                              onChange={(e) => setReassignDriverId(e.target.value)}
                                              style={{ padding: 6, borderRadius: 6, border: "1px solid #cbd5e1" }}
                                            >
                                              <option value="">Pick the driver</option>
                                              {drivers.filter((dr) => dr.id !== d.driver_id).map((dr) => (
                                                <option key={dr.id} value={dr.id}>{dr.name}</option>
                                              ))}
                                            </select>
                                            <input
                                              value={reassignNote}
                                              onChange={(e) => setReassignNote(e.target.value)}
                                              placeholder="Optional note"
                                              style={{ padding: 6, borderRadius: 6, border: "1px solid #cbd5e1" }}
                                            />
                                            <button
                                              type="button"
                                              disabled={reassignBusy || !reassignDriverId}
                                              onClick={() => reassignSeller(d)}
                                              style={{ background: "#0f172a", color: "#f8fafc", border: "none", borderRadius: 6, padding: "6px 8px", cursor: "pointer", fontSize: 12 }}
                                            >
                                              {reassignBusy ? "Saving…" : "Save new seller"}
                                            </button>
                                            {reassignMsg ? <span style={{ fontSize: 12, color: "#334155" }}>{reassignMsg}</span> : null}
                                          </div>
                                        ) : null}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
                <tr>
                  <td style={{ ...td, borderTop: "2px solid #e2e8f0" }}></td>
                  <td style={{ ...td, fontWeight: 700, borderTop: "2px solid #e2e8f0" }}>TOTAL</td>
                  <td style={{ ...td, fontWeight: 700, borderTop: "2px solid #e2e8f0" }}>{totalUnits}</td>
                  <td style={{ ...td, fontWeight: 700, borderTop: "2px solid #e2e8f0" }}>{totalPaid}</td>
                  <td style={{ ...td, fontWeight: 700, borderTop: "2px solid #e2e8f0" }}>{totalWarr}</td>
                  <td style={{ ...td, fontWeight: 700, borderTop: "2px solid #e2e8f0" }}>{totalCores}</td>
                  <td style={{ ...td, borderTop: "2px solid #e2e8f0" }}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
