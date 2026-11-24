// Calendar-day bounds in an organization timezone.
// Use these instead of `new Date("YYYY-MM-DD")` or `::timestamp` / `::date + 1 day`,
// which are interpreted in the server or database timezone (often UTC) and
// will split an America/Phoenix day in the wrong place (5 PM).

export const DEFAULT_BUSINESS_TIMEZONE = "America/Phoenix";

export function todayYmd(timeZone: string, at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function addDaysYmd(ymd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) throw new Error("Date must be YYYY-MM-DD.");
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return dt.toISOString().slice(0, 10);
}

export function parseReportDate(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

/** UTC instants for [ymd 00:00, next day 00:00) in the given IANA zone. */
export function zonedDayRange(ymd: string, timeZone: string): { start: Date; end: Date } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let t = Date.parse(`${ymd}T00:00:00Z`);
  for (let i = 0; i < 6; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
    const local = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
    const delta = Date.parse(`${local}Z`) - Date.parse(`${ymd}T00:00:00Z`);
    t -= delta;
    if (delta === 0) break;
  }
  const start = new Date(t);
  const next = addDaysYmd(ymd, 1);
  let t2 = Date.parse(`${next}T00:00:00Z`);
  for (let i = 0; i < 6; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(t2)).map((p) => [p.type, p.value]));
    const local = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
    const delta = Date.parse(`${local}Z`) - Date.parse(`${next}T00:00:00Z`);
    t2 -= delta;
    if (delta === 0) break;
  }
  return { start, end: new Date(t2) };
}

/** Instant used for stock and pending snapshots: end of the report day, or now if the day is still open. */
export function asOfInstant(end: Date, now = new Date()): Date {
  return now.getTime() < end.getTime() ? now : end;
}

/** Inclusive calendar-day range: start midnight of startYmd through exclusive midnight after endYmd. */
export function inclusiveYmdRange(startYmd: string, endYmd: string, timeZone: string): {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
  timeZone: string;
} {
  const start = zonedDayRange(startYmd, timeZone).start;
  const end = zonedDayRange(endYmd, timeZone).end;
  return { start, end, startIso: start.toISOString(), endIso: end.toISOString(), timeZone };
}

/** Optional bounds: a missing start or end stays unbounded (null ISO). */
export function optionalYmdBounds(startRaw: string | null | undefined, endRaw: string | null | undefined, timeZone: string): {
  startYmd: string | null;
  endYmd: string | null;
  startIso: string | null;
  endIso: string | null;
  timeZone: string;
} {
  const startYmd = parseReportDate(startRaw);
  const endYmd = parseReportDate(endRaw);
  return {
    startYmd,
    endYmd,
    startIso: startYmd ? zonedDayRange(startYmd, timeZone).start.toISOString() : null,
    endIso: endYmd ? zonedDayRange(endYmd, timeZone).end.toISOString() : null,
    timeZone,
  };
}

/** Instant for ymd + HH:mm[:ss] in the given IANA zone. Defaults to noon if no time is given. */
export function zonedDateTime(ymd: string, timeHHMM: string | null | undefined, timeZone: string): Date {
  const { start } = zonedDayRange(ymd, timeZone);
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec((timeHHMM || "").trim());
  const h = m ? Number(m[1]) : 12;
  const min = m ? Number(m[2]) : 0;
  const s = m ? Number(m[3] || 0) : 0;
  if (h > 23 || min > 59 || s > 59) throw new Error("Time must be HH:MM.");
  return new Date(start.getTime() + ((h * 60 + min) * 60 + s) * 1000);
}

export function zonedTimeHM(at: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.hour}:${parts.minute}`;
}

