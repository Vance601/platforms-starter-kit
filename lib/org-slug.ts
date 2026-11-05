// Normalize a company/org slug from a URL, SMS link, or typed code.
// Phones often include a trailing "." or "," when they auto-link a URL in a
// text message (e.g. ".../d/duggers/driver."), which used to make the driver
// login page show "Unknown company." with no way out.
export function normalizeOrgSlug(raw: unknown): string {
  let s = String(raw ?? "").trim().toLowerCase();
  try {
    s = decodeURIComponent(s);
  } catch {
    // already decoded or malformed - keep as-is
  }
  s = s.trim().toLowerCase();
  // Drop wrapping punctuation SMS/linkifiers often glue on.
  s = s.replace(/^[^a-z0-9]+/i, "").replace(/[^a-z0-9]+$/i, "");
  // Keep only slug-safe characters (collapse the rest).
  s = s.replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  // Common short names for Dugger's.
  if (s === "dugger" || s === "dugger-s" || s === "duggers-phx" || s === "duggers-abq" || s === "duggers-tucson") {
    s = "duggers";
  }
  if (s === "phoenix") s = "phx";
  if (s === "albuquerque") s = "abq";
  return s;
}
