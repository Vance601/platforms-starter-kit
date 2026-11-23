import { asOfInstant, todayYmd, zonedDayRange } from "../lib/daily-movements-report";

function eq(name: string, got: unknown, expected: unknown) {
  const g = got instanceof Date ? got.toISOString() : got;
  const e = expected instanceof Date ? expected.toISOString() : expected;
  if (g !== e) {
    throw new Error(`${name}: got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`);
  }
  console.log(`PASS  ${name}`);
}

const phoenix = "America/Phoenix";
const nov19 = zonedDayRange("2026-11-19", phoenix);
eq("Phoenix Nov 19 start", nov19.start, new Date("2026-11-19T07:00:00.000Z"));
eq("Phoenix Nov 19 end", nov19.end, new Date("2026-11-20T07:00:00.000Z"));

const jan = zonedDayRange("2026-01-15", phoenix);
eq("Phoenix Jan 15 start (no DST)", jan.start, new Date("2026-01-15T07:00:00.000Z"));
eq("Phoenix Jan 15 end", jan.end, new Date("2026-01-16T07:00:00.000Z"));

const ny = zonedDayRange("2026-11-19", "America/New_York");
eq("Eastern Nov 19 start (EST)", ny.start, new Date("2026-11-19T05:00:00.000Z"));
eq("Eastern Nov 19 end", ny.end, new Date("2026-11-20T05:00:00.000Z"));

const julyNy = zonedDayRange("2026-07-15", "America/New_York");
eq("Eastern Jul 15 start (EDT)", julyNy.start, new Date("2026-07-15T04:00:00.000Z"));
eq("Eastern Jul 15 end", julyNy.end, new Date("2026-07-16T04:00:00.000Z"));

eq("todayYmd in Phoenix at 2026-11-20 06:30Z (still Nov 19)", todayYmd(phoenix, new Date("2026-11-20T06:30:00.000Z")), "2026-11-19");
eq("todayYmd in Phoenix at 2026-11-20 07:00Z (midnight)", todayYmd(phoenix, new Date("2026-11-20T07:00:00.000Z")), "2026-11-20");

const end = new Date("2026-11-20T07:00:00.000Z");
eq("asOfInstant past day uses end", asOfInstant(end, new Date("2026-11-23T19:30:00.000Z")), end);
eq(
  "asOfInstant open day uses now",
  asOfInstant(new Date("2026-11-24T07:00:00.000Z"), new Date("2026-11-23T19:30:00.000Z")),
  new Date("2026-11-23T19:30:00.000Z"),
);

console.log("All date checks passed");
