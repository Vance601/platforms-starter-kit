import { toSortableIso } from "../lib/sortable-iso";

function eq(name: string, got: unknown, expected: unknown) {
  if (got !== expected) throw new Error(`${name}: got ${JSON.stringify(got)} expected ${JSON.stringify(expected)}`);
  console.log(`PASS  ${name}`);
}

const d = new Date("2026-11-19T15:27:39.840Z");
eq("Date becomes ISO", toSortableIso(d), "2026-11-19T15:27:39.840Z");
eq("ISO string stays ISO", toSortableIso("2026-11-19T15:27:39.840Z"), "2026-11-19T15:27:39.840Z");
eq("null is empty", toSortableIso(null), "");
eq("empty string is empty", toSortableIso(""), "");

const rows = [
  { sold_at: new Date("2026-11-19T15:00:00.000Z"), barcode: "B" },
  { sold_at: new Date("2026-11-20T04:00:00.000Z"), barcode: "A" },
  { sold_at: null as Date | null, barcode: "C" },
];
const sorted = [...rows].sort(
  (a, b) => toSortableIso(b.sold_at).localeCompare(toSortableIso(a.sold_at)) || a.barcode.localeCompare(b.barcode),
);
eq("sort newest first", sorted.map((r) => r.barcode).join(","), "A,B,C");

// The previous implementation threw here.
let threw = false;
try {
  rows.sort((a, b) => (b.sold_at || ("" as string)).localeCompare(a.sold_at as unknown as string) || a.barcode.localeCompare(b.barcode));
} catch (e) {
  threw = e instanceof TypeError && String(e).includes("localeCompare is not a function");
}
// b.sold_at || "" when sold_at is a Date is the Date (truthy), so localeCompare throws.
eq("old sort throws TypeError on Date", threw, true);

console.log("All core-accountability date checks passed");
