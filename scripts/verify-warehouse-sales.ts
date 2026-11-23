import {
  isChrisRoudabushName,
  normalizeDriverName,
  resolveSaleSeller,
  SELL_WAREHOUSE_HELP,
} from "../lib/driver-roles";
import { dailyMovementsToCsv } from "../lib/daily-movements-report";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean) {
  if (cond) {
    passed += 1;
    console.log(`ok  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}`);
  }
}

check("normalize trims and collapses space", normalizeDriverName("  Chris   Roudabush ") === "chris roudabush");
check("chris name matches", isChrisRoudabushName("Chris Roudabush"));
check("chris name matches odd spacing", isChrisRoudabushName("  chris   ROUDABUSH "));
check("other name does not match chris", !isChrisRoudabushName("Christopher Leslie"));
check("TEST-BOT name does not match chris", !isChrisRoudabushName("TEST-BOT Warehouse"));

const routeDriver = resolveSaleSeller({
  sessionDriverId: "drv-route",
  isWarehouse: false,
  claimedTruckId: "trk-1",
  batteryTruckId: "trk-1",
  soldByDriverId: null,
});
check("route driver on claimed truck is the seller", routeDriver.ok && routeDriver.sellerId === "drv-route" && routeDriver.requiresPick === false);

const warehouseNoPick = resolveSaleSeller({
  sessionDriverId: "drv-wh",
  isWarehouse: true,
  claimedTruckId: "trk-1",
  batteryTruckId: "trk-1",
  soldByDriverId: null,
});
check("warehouse without a pick is rejected", !warehouseNoPick.ok && warehouseNoPick.error === SELL_WAREHOUSE_HELP);

const warehouseSelf = resolveSaleSeller({
  sessionDriverId: "drv-wh",
  isWarehouse: true,
  claimedTruckId: null,
  batteryTruckId: "trk-2",
  soldByDriverId: "drv-wh",
});
check("warehouse cannot credit themselves", !warehouseSelf.ok && warehouseSelf.error === SELL_WAREHOUSE_HELP);

const warehousePick = resolveSaleSeller({
  sessionDriverId: "drv-wh",
  isWarehouse: true,
  claimedTruckId: null,
  batteryTruckId: "trk-2",
  soldByDriverId: "drv-route",
});
check(
  "warehouse pick credits the route driver",
  warehousePick.ok && warehousePick.sellerId === "drv-route" && warehousePick.requiresPick === true,
);

const notHolding = resolveSaleSeller({
  sessionDriverId: "drv-a",
  isWarehouse: false,
  claimedTruckId: "trk-1",
  batteryTruckId: "trk-2",
  soldByDriverId: null,
});
check("non-holder without a pick is rejected", !notHolding.ok);

const emptyPayload = {
  ok: true as const,
  generatedAt: "2026-11-23T00:00:00.000Z",
  orgs: [],
  reports: [
    {
      org: { id: "org-demo", slug: "demo-test-bot", name: "TEST-BOT Demo", isDemo: true },
      timezone: "America/Phoenix",
      date: "2026-11-20",
      range: { start: "", end: "" },
      incoming: { count: 0, items: [], byLocation: [] },
      sold: {
        count: 1,
        items: [
          {
            time: "2026-11-20T17:00:00.000Z",
            timeLocal: "2026-11-20, 10:00:00 MST",
            barcode: "TEST-BOT-48-0001",
            serialNumber: null,
            model: "48",
            type: "Alpha",
            qty: 1,
            location: "Elwood",
            truck: "999",
            driver: "TEST-BOT Driver",
            loggedBy: "TEST-BOT Warehouse",
            callNumber: "TEST-1001",
            invoiceNumber: null,
            saleAmount: null,
            wholesaleCost: 0,
            isWarranty: false,
            coreStatus: "owed",
          },
        ],
        byLocation: [],
        byTruck: [],
        byDriver: [],
      },
      cores: {
        collected: { count: 0, items: [] },
        pending: { count: 0, agedOver7Days: 0, items: [], agedItems: [], byLocation: [], byTruck: [] },
        returned: { count: 0, items: [] },
        credited: { count: 0, items: [] },
      },
      transfers: { count: 0, items: [] },
      inventory: { available: 0, warehouse: 0, onTrucks: 0, byLocationAndSize: [] },
    },
  ],
};

let csvOk = false;
try {
  const csv = dailyMovementsToCsv(emptyPayload as Parameters<typeof dailyMovementsToCsv>[0]);
  const header = csv.split("\n")[0];
  csvOk =
    header.includes("logged_by") &&
    csv.includes("TEST-BOT Driver") &&
    csv.includes("TEST-BOT Warehouse") &&
    csv.includes("TEST-BOT-48-0001");
  check("daily movements CSV has a logged_by column", header.includes("logged_by"));
  check("daily movements CSV writes the selling driver and logged-by name", csvOk);
} catch (err) {
  check(`daily movements CSV builds (${err instanceof Error ? err.message : err})`, false);
}

check("help text is the agreed wording", SELL_WAREHOUSE_HELP === "Moving batteries to a truck? Use Transfer. Recording a sale for a driver? Pick the driver.");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
