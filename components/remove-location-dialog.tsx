"use client";

import { useEffect, useState } from "react";

type Ref = { table: string; column: string; count: number };
type Other = { id: string; name: string; slug: string; company_name: string };

export type RemovableLocation = { id: string; name: string; company_id?: string; company_name?: string | null };

const LABEL: Record<string, string> = {
  "batteries.location_id": "Batteries",
  "trucks.location_id": "Trucks",
  "users.home_location_id": "Users (home location)",
  "drivers.location_id": "Drivers",
  "drivers.home_location_id": "Drivers (home location)",
  "battery_movements.from_location_id": "Battery movements (from)",
  "battery_movements.to_location_id": "Battery movements (to)",
  "mbs_invoices.location_id": "Invoices",
  "sales.location_id": "Sales",
  "core_returns.location_id": "Core returns",
  "delivery_receipts.location_id": "Delivery receipts",
  "warranty_pickups.location_id": "Warranty pickups",
  "warranty_credit_memos.location_id": "Warranty credit memos",
};

export function RemoveLocationDialog({
  loc,
  onClose,
  onDone,
}: {
  loc: RemovableLocation;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refs, setRefs] = useState<Ref[]>([]);
  const [others, setOthers] = useState<Other[]>([]);
  const [reassignTo, setReassignTo] = useState("");
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(`/api/locations/delete?id=${encodeURIComponent(loc.id)}`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error(d.error || "Could not load location usage");
        if (cancelled) return;
        setRefs((d.refs || []).filter((x: Ref) => x.count > 0));
        setOthers(d.otherLocations || []);
        setTotal(d.total || 0);
        const prefer =
          (d.otherLocations || []).find((o: Other) => /elwood/i.test(o.name)) ||
          (d.otherLocations || [])[0];
        if (prefer) setReassignTo(prefer.id);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load location usage");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loc.id]);

  const mustReassign = total > 0;

  async function confirm() {
    if (mustReassign && !reassignTo) {
      setError("Choose a location to move these records to.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/locations/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: loc.id, reassignTo: reassignTo || undefined }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Failed to remove location");
      onDone(d.message || `${loc.name} was removed.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove location");
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-loc-title"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h2 id="remove-loc-title" className="text-lg font-semibold">
          Remove {loc.name}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {loc.company_name ? `Company: ${loc.company_name}. ` : ""}
          Records will be moved to the location you pick, then {loc.name} will be removed.
        </p>

        {loading ? <p className="mt-3 text-sm">Checking what is tied to this location…</p> : null}

        {!loading && refs.length === 0 ? (
          <p className="mt-3 text-sm">Nothing is tied to this location. It can be removed directly.</p>
        ) : null}

        {!loading && refs.length > 0 ? (
          <div className="mt-3">
            <p className="text-sm font-medium">These will move:</p>
            <ul className="mt-1 text-sm list-disc pl-5">
              {refs.map((r) => (
                <li key={`${r.table}.${r.column}`}>
                  {LABEL[`${r.table}.${r.column}`] || `${r.table}.${r.column}`}: {r.count}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!loading && others.length > 0 ? (
          <label className="mt-4 block text-sm font-medium">
            Move everything to
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm font-normal"
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value)}
              disabled={busy}
            >
              <option value="">Select a location…</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {!loading && mustReassign && others.length === 0 ? (
          <p className="mt-3 text-sm text-red-600">
            There is no other active location in this company to move records to. Add one first (for Duggers ERS, that should be Elwood).
          </p>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="rounded-md border px-3 py-2 text-sm" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-40"
            disabled={busy || loading || (mustReassign && !reassignTo)}
            onClick={confirm}
          >
            {busy ? "Removing…" : mustReassign ? "Move records and remove" : "Remove location"}
          </button>
        </div>
      </div>
    </div>
  );
}
