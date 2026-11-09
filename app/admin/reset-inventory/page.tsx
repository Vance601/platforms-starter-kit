"use client";

import { useEffect, useMemo, useState } from "react";

type Plan = {
  orgId: string;
  orgName: string;
  companySlugs: string[];
  before: Record<string, number>;
  otherOrgsBefore: Record<string, number>;
};

type ExportPayload = {
  success: boolean;
  plan: Plan;
  exportedAt: string;
  backupVerified: boolean;
  files: {
    manifest: string;
    json: Record<string, string>;
    csv: Record<string, string>;
  };
  error?: string;
};

type ResetPayload = {
  success: boolean;
  deleted: Record<string, number>;
  after: Record<string, number>;
  otherOrgsAfter: Record<string, number>;
  duggersCleared: boolean;
  otherOrgsUnchanged: boolean;
  files?: ExportPayload["files"];
  exportedAt?: string;
  error?: string;
};

function downloadBlob(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Minimal ZIP (store only) so we can ship CSVs without a new dependency. */
function zipStore(files: Record<string, string>): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const fileEntries = Object.entries(files);

  const u16 = (n: number) => {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    return b;
  };
  const u32 = (n: number) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n, true);
    return b;
  };
  const concat = (arrs: Uint8Array[]) => {
    const len = arrs.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    for (const a of arrs) {
      out.set(a, o);
      o += a.length;
    }
    return out;
  };

  for (const [name, text] of fileEntries) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(text);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0), // crc optional for store in many readers; set 0
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data,
    ]);
    parts.push(local);
    const cen = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    central.push(cen);
    offset += local.length;
  }
  const centralDir = concat(central);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(fileEntries.length),
    u16(fileEntries.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);
  return new Blob([concat([...parts, centralDir, end])], { type: "application/zip" });
}

export default function ResetInventoryPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<ResetPayload | null>(null);
  const [lastExport, setLastExport] = useState<ExportPayload | null>(null);

  async function loadDryRun() {
    setBusy(true);
    setError("");
    try {
      const gate = await fetch("/api/migrate-reset-duggers-inventory?check=1", { cache: "no-store" });
      const gj = await gate.json().catch(() => ({}));
      if (!gate.ok || !gj.platform) {
        setAllowed(false);
        setBusy(false);
        return;
      }
      setAllowed(true);
      const r = await fetch("/api/migrate-reset-duggers-inventory?dry_run=1", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok || !d.success) {
        setError(d.error || "Could not load counts");
      } else {
        setPlan(d.plan);
      }
    } catch {
      setError("Network error loading counts");
      setAllowed(false);
    }
    setBusy(false);
  }

  useEffect(() => {
    loadDryRun();
  }, []);

  const totalRows = useMemo(
    () => Object.values(plan?.before || {}).reduce((s, n) => s + (n || 0), 0),
    [plan],
  );

  async function downloadBackup() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/migrate-reset-duggers-inventory?export=1", { cache: "no-store" });
      const d: ExportPayload = await r.json();
      if (!r.ok || !d.success) {
        setError(d.error || "Export failed");
        setBusy(false);
        return;
      }
      setLastExport(d);
      const stamp = (d.exportedAt || new Date().toISOString()).slice(0, 19).replace(/[:T]/g, "-");
      const bundle = {
        exportedAt: d.exportedAt,
        plan: d.plan,
        backupVerified: d.backupVerified,
        manifest: d.files.manifest,
        tables: Object.fromEntries(
          Object.entries(d.files.json).map(([k, v]) => [k.replace(/\.json$/, ""), JSON.parse(v)]),
        ),
      };
      downloadBlob(`duggers-inventory-backup-${stamp}.json`, JSON.stringify(bundle, null, 2), "application/json");

      const csvFiles: Record<string, string> = {
        "manifest.txt": d.files.manifest,
        ...d.files.csv,
      };
      const zip = zipStore(csvFiles);
      const url = URL.createObjectURL(zip);
      const a = document.createElement("a");
      a.href = url;
      a.download = `duggers-inventory-backup-${stamp}-csv.zip`;
      a.click();
      URL.revokeObjectURL(url);

      setBackupDownloaded(true);
    } catch {
      setError("Network error during export");
    }
    setBusy(false);
  }

  async function runReset() {
    if (!backupDownloaded || confirmText !== "RESET-DUGGERS-INVENTORY") return;
    if (!window.confirm("This permanently deletes Duggers inventory, sales, and warranties. Continue?")) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch("/api/migrate-reset-duggers-inventory?confirm=RESET-DUGGERS-INVENTORY", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "RESET-DUGGERS-INVENTORY" }),
      });
      const d: ResetPayload = await r.json();
      if (!r.ok || !d.success) {
        setError(d.error || "Reset failed — nothing should have been partially applied if the transaction rolled back.");
        setResult(d);
      } else {
        setResult(d);
        // Refresh dry-run counts
        const dry = await fetch("/api/migrate-reset-duggers-inventory?dry_run=1", { cache: "no-store" });
        const dj = await dry.json();
        if (dj.success) setPlan(dj.plan);
      }
    } catch {
      setError("Network error during reset");
    }
    setBusy(false);
  }

  if (allowed === false) {
    return (
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Reset inventory</h1>
        <p className="text-red-600">Only the Duggers platform owner/admin can use this page.</p>
      </div>
    );
  }

  const canReset = backupDownloaded && confirmText === "RESET-DUGGERS-INVENTORY" && !busy;

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Reset Duggers inventory</h1>
        <p className="text-sm text-muted-foreground">
          Removes batteries (including sold), sales, warranties, deliveries, cores, and related rows for{" "}
          <strong>Duggers only</strong> (abq / phx / tucson). Does not touch users, drivers, companies, settings, the
          battery catalog, audit history, or demo leads.
        </p>
      </div>

      {error && <div className="rounded border border-red-300 bg-red-50 text-red-800 px-3 py-2 text-sm">{error}</div>}

      {plan && (
        <div className="rounded border p-4">
          <div className="font-semibold mb-1">
            {plan.orgName}{" "}
            <span className="text-muted-foreground font-normal">({plan.companySlugs.join(", ")})</span>
          </div>
          <p className="text-sm text-muted-foreground mb-3">Rows that will be deleted ({totalRows.toLocaleString()} total)</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-1">Table</th>
                <th className="py-1 text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(plan.before)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([t, n]) => (
                  <tr key={t} className="border-b border-dashed">
                    <td className="py-1 font-mono text-xs">{t}</td>
                    <td className="py-1 text-right">{n}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">1. Download backup</h2>
        <p className="text-sm text-muted-foreground">
          Required before reset. Downloads a full JSON backup and a ZIP of CSV files for every table above.
        </p>
        <button
          type="button"
          disabled={busy || !plan}
          onClick={downloadBackup}
          className="rounded bg-slate-900 text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          {busy ? "Working…" : "Download backup (JSON + CSV zip)"}
        </button>
        {backupDownloaded && (
          <p className="text-sm text-green-700">
            Backup downloaded{lastExport?.backupVerified ? " and row counts verified" : ""}. Reset is unlocked after you
            type the confirm phrase.
          </p>
        )}
      </div>

      <div className="rounded border border-red-200 p-4 space-y-3">
        <h2 className="font-semibold text-red-800">2. Reset</h2>
        <label className="block text-sm">
          Type <code className="bg-slate-100 px-1">RESET-DUGGERS-INVENTORY</code> to enable
          <input
            className="mt-1 w-full border rounded px-3 py-2 font-mono text-sm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESET-DUGGERS-INVENTORY"
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          disabled={!canReset}
          onClick={runReset}
          className="rounded bg-red-700 text-white px-4 py-2 text-sm disabled:opacity-40"
        >
          Reset Duggers inventory
        </button>
      </div>

      {result && (
        <div className="rounded border p-4 space-y-3">
          <h2 className="font-semibold">Result</h2>
          <p className={result.duggersCleared ? "text-green-700 text-sm" : "text-red-700 text-sm"}>
            Duggers cleared: {result.duggersCleared ? "yes (all inventory tables at 0)" : "no — check counts"}
          </p>
          <p className={result.otherOrgsUnchanged ? "text-green-700 text-sm" : "text-red-700 text-sm"}>
            Other orgs unchanged: {result.otherOrgsUnchanged ? "yes" : "no — investigate"}
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-1">Table</th>
                <th className="py-1 text-right">Deleted</th>
                <th className="py-1 text-right">After</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys({ ...result.deleted, ...result.after })
                .sort()
                .map((t) => (
                  <tr key={t} className="border-b border-dashed">
                    <td className="py-1 font-mono text-xs">{t}</td>
                    <td className="py-1 text-right">{result.deleted?.[t] ?? "—"}</td>
                    <td className="py-1 text-right">{result.after?.[t] ?? "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
