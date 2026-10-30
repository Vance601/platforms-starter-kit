#!/usr/bin/env node
// Read-only smoke test against a deployed site. Never writes data.
//   node scripts/smoke.mjs https://your-deployment.vercel.app
// Optional driver check (must be the TEST-BOT driver, never a real driver):
//   SMOKE_DRIVER_ID=... SMOKE_DRIVER_PIN=... node scripts/smoke.mjs <url>
const base = (process.argv[2] || process.env.SMOKE_BASE_URL || "").replace(/\/$/, "");
if (!base) {
  console.error("Usage: node scripts/smoke.mjs <base-url>");
  process.exit(2);
}
let failed = 0;
async function check(name, path, expect, init = {}) {
  try {
    const res = await fetch(base + path, { redirect: "manual", ...init });
    const ok = expect(res);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (${res.status}${res.headers.get("location") ? " -> " + res.headers.get("location") : ""})`);
    if (!ok) failed++;
    return res;
  } catch (e) {
    console.log(`FAIL  ${name}  (${e.message})`);
    failed++;
  }
}
const is = (...codes) => (r) => codes.includes(r.status);
const redirectsTo = (p) => (r) => [301, 302, 303, 307, 308].includes(r.status) && (r.headers.get("location") || "").includes(p);

await check("home page loads", "/", is(200, 307, 308));
await check("login page loads", "/login", is(200));
await check("driver login page loads", "/driver/login", is(200));
// Staff APIs must refuse anonymous callers (tenant guard).
for (const p of ["/api/trucks/overview", "/api/activity/feed", "/api/locations/overview", "/api/warranty/pickups", "/api/org-settings", "/api/audit-log", "/api/reports/sales"]) {
  await check(`anonymous blocked: ${p}`, p, is(401, 403, 307));
}
await check("anonymous upload blocked", "/api/receive-delivery/upload", is(401, 403, 307), { method: "POST" });
await check("driver API blocked without session", "/api/battery/return-core", is(401));
await check("VIN decode blocked without session", "/api/vin/decode", is(401), { method: "POST" });
await check("VIN photo blocked without session", "/api/vin/photo", is(401), { method: "POST" });
// Old mock pages now redirect to the real screens (may first bounce to /login).
await check("/core-returns redirects", "/core-returns", (r) => r.status >= 300 && r.status < 400);
await check("/team/x/edit redirects", "/team/x/edit", (r) => r.status >= 300 && r.status < 400);

const id = process.env.SMOKE_DRIVER_ID, pin = process.env.SMOKE_DRIVER_PIN;
if (id && pin) {
  const res = await fetch(base + "/api/auth-driver", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ driverId: id, pin }),
  });
  const data = await res.json().catch(() => ({}));
  const name = data?.driver?.name || "";
  if (!/TEST-BOT/i.test(name)) {
    console.log(`FAIL  driver login: refusing - driver "${name}" is not the TEST-BOT driver`);
    failed++;
  } else {
    const cookie = (res.headers.get("set-cookie") || "").split(";")[0];
    await check("TEST-BOT driver can read cores (read-only)", "/api/battery/return-core", is(200), { headers: { cookie } });
  }
}
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
