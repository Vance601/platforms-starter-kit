"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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
type ApiResponse = {
  success: boolean;
  error?: string;
  range?: { start: string; end: string };
  salesByDriver?: SaleRow[];
  typeByDriver?: TypeRow[];
  coresByDriver?: CoreRow[];
};

// A merged per-driver row the table renders.
type MergedRow = {
  driverId: string;
  driverName: string;
  unitsSold: number;
  warranties: number;
  paid: number;
  coresReturned: number;
  types: { name: string; count: number }[];
};

function defaultStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
}
function defaultEnd(): string {
  return new Date().toISOString().split("T")[0];
}

export default function DriverSalesPage() {
  const [start, setStart] = useState(defaultStart());
  const [end, setEnd] = useState(defaultEnd());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<MergedRow[]>([]);
  const [loadedRange, setLoadedRange] = useState<{ start: string; end: string } | null>(null);

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

      // Merge the three arrays by driver_id.
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
          // Driver returned cores but had no sales in range - still show them.
          row = {
            driverId: c.driver_id,
            driverName: "(driver)",
            unitsSold: 0,
            warranties: 0,
            paid: 0,
            coresReturned: 0,
            types: [],
          };
          map.set(c.driver_id, row);
        }
        row.coresReturned = c.cores_returned;
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

  function exportCSV() {
    if (rows.length === 0) return;
    const header = "Driver,Units Sold,Paid Sales,Warranties,Cores Returned,Type Breakdown\n";
    const body = rows
      .map((r) => {
        const types = r.types.map((t) => `${t.name}:${t.count}`).join(" ");
        // Wrap fields that may contain spaces/commas in quotes.
        return [
          `"${r.driverName}"`,
          r.unitsSold,
          r.paid,
          r.warranties,
          r.coresReturned,
          `"${types}"`,
        ].join(",");
      })
      .join("\n");

    const totalUnits = rows.reduce((s, r) => s + r.unitsSold, 0);
    const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
    const totalWarr = rows.reduce((s, r) => s + r.warranties, 0);
    const totalCores = rows.reduce((s, r) => s + r.coresReturned, 0);
    const totalRow = `"TOTAL",${totalUnits},${totalPaid},${totalWarr},${totalCores},""`;

    const blob = new Blob([header + body + "\n" + totalRow], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `driver-sales-${start}-to-${end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --- Styles (inline, neutral light theme to match the owner/admin pages) ---
  const page: React.CSSProperties = {
    maxWidth: 1000,
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

  // --- Report ---
  return (
    <div style={page}>
      <Link href="/" style={backLink}>Back to Dashboard</Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Driver Sales Report</h1>
        <button style={btnOutline} onClick={exportCSV} disabled={rows.length === 0}>
          Export CSV
        </button>
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
                  <th style={th}>Driver</th>
                  <th style={th}>Units Sold</th>
                  <th style={th}>Paid</th>
                  <th style={th}>Warranties</th>
                  <th style={th}>Cores Returned</th>
                  <th style={th}>Type Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.driverId}>
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
                ))}
                <tr>
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
