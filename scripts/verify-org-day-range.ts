import {
  addDaysYmd,
  inclusiveYmdRange,
  optionalYmdBounds,
  parseReportDate,
  todayYmd,
  zonedDayRange,
} from "../lib/org-day-range";

function eq(name: string, got: unknown, expected: unknown) {
  const g = got instanceof Date ? got.toISOString() : got;
  const e = expected instanceof Date ? expected.toISOString() : expected;
  if (g !== e) {
    throw new Error(`${name}: got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`);
  }
  console.log(`PASS  ${name}`);
}

function countIn(times: string[], start: Date, end: Date, inclusiveEnd = false): number {
  const s = start.getTime();
  const e = end.getTime();
  return times.filter((iso) => {
    const t = Date.parse(iso);
    return inclusiveEnd ? t >= s && t <= e : t >= s && t < e;
  }).length;
}

const phoenix = "America/Phoenix";
const nov19 = zonedDayRange("2026-11-19", phoenix);
eq("Phoenix Nov 19 start", nov19.start, new Date("2026-11-19T07:00:00.000Z"));
eq("Phoenix Nov 19 end", nov19.end, new Date("2026-11-20T07:00:00.000Z"));

const range = inclusiveYmdRange("2026-11-19", "2026-11-19", phoenix);
eq("inclusive single-day startIso", range.startIso, "2026-11-19T07:00:00.000Z");
eq("inclusive single-day endIso", range.endIso, "2026-11-20T07:00:00.000Z");

const week = inclusiveYmdRange("2026-11-16", "2026-11-22", phoenix);
eq("week start", week.startIso, "2026-11-16T07:00:00.000Z");
eq("week end", week.endIso, "2026-11-23T07:00:00.000Z");

const bounds = optionalYmdBounds("2026-11-19", "2026-11-22", phoenix);
eq("optional bounds start", bounds.startIso, "2026-11-19T07:00:00.000Z");
eq("optional bounds end", bounds.endIso, "2026-11-23T07:00:00.000Z");
eq("optional missing start", optionalYmdBounds(null, "2026-11-19", phoenix).startIso, null);
eq("optional missing end", optionalYmdBounds("2026-11-19", null, phoenix).endIso, null);
eq("parseReportDate rejects junk", parseReportDate("11/19/2026"), null);
eq("addDaysYmd wraps the month", addDaysYmd("2026-11-30", 1), "2026-12-01");
eq(
  "todayYmd in Phoenix just before midnight",
  todayYmd(phoenix, new Date("2026-11-20T06:59:59.000Z")),
  "2026-11-19",
);

// Anonymized sold_at instants from the Dugger's daily movements report for
// Friday, November 19, 2026. Times only — no driver names, barcodes, or call
// numbers. There are 42, matching the report's sales count.
const duggersNov19Sales: string[] = [
  "2026-11-19T15:27:39.840Z",
  "2026-11-19T16:33:16.775Z",
  "2026-11-19T16:35:11.025Z",
  "2026-11-19T16:42:50.366Z",
  "2026-11-19T16:43:25.531Z",
  "2026-11-19T16:43:51.390Z",
  "2026-11-19T16:44:30.643Z",
  "2026-11-19T16:47:22.937Z",
  "2026-11-19T16:50:42.670Z",
  "2026-11-19T16:50:58.370Z",
  "2026-11-19T16:51:09.762Z",
  "2026-11-19T16:51:36.694Z",
  "2026-11-19T16:54:04.750Z",
  "2026-11-19T17:35:43.337Z",
  "2026-11-19T18:23:56.349Z",
  "2026-11-19T19:00:07.491Z",
  "2026-11-19T19:25:36.379Z",
  "2026-11-19T19:31:17.047Z",
  "2026-11-19T19:34:38.574Z",
  "2026-11-19T19:34:56.898Z",
  "2026-11-19T20:32:24.339Z",
  "2026-11-19T21:17:01.493Z",
  "2026-11-19T21:45:32.889Z",
  "2026-11-19T21:55:17.030Z",
  "2026-11-19T22:24:21.435Z",
  "2026-11-19T23:03:41.495Z",
  "2026-11-19T23:04:16.219Z",
  "2026-11-19T23:04:53.309Z",
  "2026-11-19T23:42:49.195Z",
  "2026-11-19T23:55:58.858Z",
  "2026-11-20T00:36:48.038Z",
  "2026-11-20T02:32:55.772Z",
  "2026-11-20T02:56:56.669Z",
  "2026-11-20T04:43:49.339Z",
  "2026-11-20T04:45:07.099Z",
  "2026-11-20T04:46:05.742Z",
  "2026-11-20T04:46:51.989Z",
  "2026-11-20T04:47:10.223Z",
  "2026-11-20T04:48:44.793Z",
  "2026-11-20T04:49:44.007Z",
  "2026-11-20T05:35:14.517Z",
  "2026-11-20T05:35:51.242Z",
];

eq("fixture has 42 sales", duggersNov19Sales.length, 42);
eq(
  "Driver Sales Phoenix window counts the same 42 as the daily report",
  countIn(duggersNov19Sales, range.start, range.end),
  42,
);

// The previous Driver Sales window, when the server ran in UTC, was
// new Date("YYYY-MM-DD") through 23:59:59 in the server timezone.
const utcStart = new Date("2026-11-19T00:00:00.000Z");
const utcEndInclusive = new Date("2026-11-19T23:59:59.000Z");
eq(
  "UTC calendar day of this fixture is 30, not 42",
  countIn(duggersNov19Sales, utcStart, utcEndInclusive, true),
  30,
);

// Edge instants at the Phoenix midnight boundary.
eq(
  "11:59 PM Nov 18 Phoenix is not in Nov 19",
  countIn(["2026-11-19T06:59:59.999Z"], range.start, range.end),
  0,
);
eq(
  "12:00 AM Nov 19 Phoenix is in Nov 19",
  countIn(["2026-11-19T07:00:00.000Z"], range.start, range.end),
  1,
);
eq(
  "11:59:59 PM Nov 19 Phoenix is in Nov 19",
  countIn(["2026-11-20T06:59:59.999Z"], range.start, range.end),
  1,
);
eq(
  "12:00 AM Nov 20 Phoenix is not in Nov 19",
  countIn(["2026-11-20T07:00:00.000Z"], range.start, range.end),
  0,
);

console.log("All org day-range checks passed");
