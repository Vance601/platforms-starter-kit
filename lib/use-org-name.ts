"use client";
import { useEffect, useState } from "react";

export const BRAND_FALLBACK = "Battery City";
let cache: string | null = null;

// Current org's name, falling back to "Battery City".
export function useOrgName(): string {
  const [name, setName] = useState<string>(cache ?? BRAND_FALLBACK);
  useEffect(() => {
    if (cache) return;
    fetch("/api/org/name", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.name) { cache = String(d.name); setName(cache); } })
      .catch(() => {});
  }, []);
  return name;
}
