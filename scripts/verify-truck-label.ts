import { formatTruckLabel } from "../lib/truck-label";

function eq(name: string, got: unknown, expected: unknown) {
  if (got !== expected) throw new Error(`${name}: got ${JSON.stringify(got)} expected ${JSON.stringify(expected)}`);
  console.log(`PASS  ${name}`);
}

eq("plain number", formatTruckLabel("123"), "Truck #123");
eq("already prefixed", formatTruckLabel("Truck #123"), "Truck #123");
eq("duplicated prefix", formatTruckLabel("Truck #Truck #123"), "Truck #123");
eq("hash only", formatTruckLabel("#123"), "Truck #123");
eq("empty", formatTruckLabel(""), "Truck");
eq("null", formatTruckLabel(null), "Truck");

console.log("All truck-label checks passed");
