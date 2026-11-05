// Normalize a company/org slug from a URL, SMS link, typed code, or localStorage.
// Phones often include a trailing "." or "," when they auto-link a URL in a
// text message (e.g. ".../d/duggers/driver.").
export function normalizeOrgSlug(raw: unknown): string {
  let s = String(raw ?? "").trim().toLowerCase();
  try {
    // Decode repeatedly in case an SMS client double-encoded the value.
    for (let i = 0; i < 3; i++) {
      const next = decodeURIComponent(s);
      if (next === s) break;
      s = next;
    }
  } catch {
    // already decoded or malformed - keep as-is
  }
  s = s.trim().toLowerCase();
  // If someone pasted a full driver URL, pull the /d/<slug>/ bit out.
  const fromPath = s.match(/(?:^|\/)d\/([a-z0-9._~-]+)(?:\/|$)/i);
  if (fromPath) s = fromPath[1];
  // Drop wrapping punctuation SMS/linkifiers often glue on.
  s = s.replace(/^[^a-z0-9]+/i, "").replace(/[^a-z0-9]+$/i, "");
  // Keep only slug-safe characters (collapse the rest).
  s = s.replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return applySlugAliases(s);
}

export function applySlugAliases(s: string): string {
  if (!s) return s;
  // Common short names / misspellings for Dugger's.
  const aliases: Record<string, string> = {
    dugger: "duggers",
    "dugger-s": "duggers",
    duggersphx: "duggers",
    "duggers-phx": "duggers",
    "duggers-abq": "duggers",
    "duggers-tucson": "duggers",
    "duggers-phx-ers": "duggers",
    ers: "duggers",
    phoenix: "phx",
    albuquerque: "abq",
  };
  return aliases[s] || s;
}

/** Compact form used to compare against organization/company display names. */
export function nameKey(raw: unknown): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
