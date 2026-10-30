"use client";
// Client hook: the signed-in org's settings, starting from the defaults so
// pages render immediately and look exactly as before for the Duggers org.
import { useEffect, useState } from "react";

export type ClientOrgSettings = { barcodePrefix: string; timezone: string; coreCharge: number };
export const CLIENT_DEFAULT_SETTINGS: ClientOrgSettings = {
  barcodePrefix: "DG",
  timezone: "America/Phoenix",
  coreCharge: 25,
};

export function useOrgSettings(): ClientOrgSettings {
  const [s, setS] = useState<ClientOrgSettings>(CLIENT_DEFAULT_SETTINGS);
  useEffect(() => {
    let alive = true;
    fetch("/api/org-settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.success && d.settings) setS({ ...CLIENT_DEFAULT_SETTINGS, ...d.settings });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return s;
}
