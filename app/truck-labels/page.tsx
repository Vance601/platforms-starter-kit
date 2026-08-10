"use client";

import { useEffect, useState } from "react";

type Truck = {
  id: string;
  truck_number: string;
  year_model: string | null;
  vin_last5: string | null;
  company: string;
};

// One printable QR sticker per truck, for the windshield or door frame.
//
// The QR encodes DG-TRUCK-<number> - the truck NUMBER, not the database id.
// A person can read it off the sticker and type it if the label is damaged,
// it means something over the radio, and it survives a data rebuild.
//
// Scanning it on /driver/transfer claims the truck: the previous driver's
// shift ends and everything loaded on that truck moves to the new driver.
export default function TruckLabelsPage() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/trucks", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success === false) {
          setError(data.error || "Could not load trucks");
        } else {
          const list: Truck[] = data.trucks || [];
          setTrucks(list);
          setSelected(new Set(list.map((t) => t.id)));
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load trucks");
        setLoading(false);
      });
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const chosen = trucks.filter((t) => selected.has(t.id));

  function print() {
    if (chosen.length === 0) return;

    const cards = chosen
      .map((t) => {
        const code = `DG-TRUCK-${t.truck_number}`;
        const url =
          "https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=0&data=" +
          encodeURIComponent(code);
        const sub = [t.year_model, t.vin_last5 ? `VIN ...${t.vin_last5}` : ""]
          .filter(Boolean)
          .join(" · ");
        return `
          <div class="card">
            <div class="num">TRUCK #${t.truck_number}</div>
            <img src="${url}" alt="" />
            <div class="code">${code}</div>
            <div class="sub">${sub}</div>
            <div class="hint">Scan at shift change to take this truck</div>
          </div>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html><head><title>Truck QR Codes</title>
<style>
  @page { size: 4in 6in; margin: 0.2in; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, Segoe UI, Arial, sans-serif; }
  .card {
    width: 3.6in; height: 5.6in;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; page-break-after: always; break-after: page;
    border: 3px solid #000; border-radius: 12px; padding: 0.2in;
  }
  .num { font-size: 30pt; font-weight: 800; letter-spacing: 1px; margin-bottom: 0.12in; }
  .card img { width: 2.7in; height: 2.7in; }
  .code { font-family: monospace; font-size: 13pt; margin-top: 0.12in; }
  .sub { font-size: 10pt; color: #444; margin-top: 0.06in; }
  .hint { font-size: 9pt; color: #666; margin-top: 0.14in; }
  @media screen {
    body { background: #f3f4f6; padding: 16px; }
    .card { background: #fff; margin: 0 auto 16px; }
  }
</style></head>
<body>${cards}</body></html>`;

    const w = window.open("", "_blank");
    if (!w) {
      alert("Allow pop-ups for this site to print truck codes.");
      return;
    }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 1200);
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Truck QR Codes</h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>
        Print one per truck and mount it where a driver can reach it — inside the windshield or
        on the door frame. At shift change the next driver scans it to take the truck, and
        everything loaded on it moves to them.
      </p>

      {error && (
        <div
          style={{
            background: "#fee",
            border: "1px solid #c00",
            padding: 12,
            borderRadius: 4,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#888" }}>Loading trucks...</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
            <button
              onClick={print}
              disabled={chosen.length === 0}
              style={{
                padding: "10px 16px",
                borderRadius: 6,
                border: "1px solid #2563eb",
                background: chosen.length === 0 ? "#eee" : "#2563eb",
                color: chosen.length === 0 ? "#999" : "#fff",
                fontWeight: 600,
                cursor: chosen.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Print {chosen.length} code{chosen.length === 1 ? "" : "s"}
            </button>
            <button
              onClick={() => setSelected(new Set(trucks.map((t) => t.id)))}
              style={{ padding: "10px 14px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
            >
              Select all
            </button>
            <button
              onClick={() => setSelected(new Set())}
              style={{ padding: "10px 14px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
            >
              Clear
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {trucks.map((t) => {
              const on = selected.has(t.id);
              return (
                <label
                  key={t.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: 14,
                    border: on ? "2px solid #2563eb" : "1px solid #ddd",
                    background: on ? "#eff6ff" : "#fafafa",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(t.id)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <span style={{ fontWeight: 600, display: "block" }}>
                      Truck #{t.truck_number}
                    </span>
                    <span style={{ fontSize: 12, color: "#777" }}>
                      {t.year_model || "—"}
                      {t.vin_last5 ? ` · VIN ...${t.vin_last5}` : ""}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "#999",
                        fontFamily: "monospace",
                        display: "block",
                        marginTop: 2,
                      }}
                    >
                      DG-TRUCK-{t.truck_number}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
