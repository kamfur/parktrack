/**
 * Operating-window helpers for driver arrival/departure lists.
 * Pending lists: overdue (any past day) + all of Warsaw today, extended to the next 12 hours
 * so late-evening shifts see the customers arriving/returning after midnight.
 * Handled lists: actual timestamp on Warsaw today OR within the last 12 hours (union).
 */

const WARSAW = "Europe/Warsaw";
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

/** YYYY-MM-DD in Europe/Warsaw */
export function warsawDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WARSAW,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * True when the planned timestamp falls on or before "today" in Warsaw.
 * Used for unit tests and to document the list contract.
 */
export function isOnOrBeforeWarsawToday(plannedIso: string, now: Date = new Date()): boolean {
  return warsawDateKey(new Date(plannedIso)) <= warsawDateKey(now);
}

/** Inclusive lower bound: midnight Europe/Warsaw for the current calendar day, as UTC ISO. */
export function startOfWarsawTodayIso(now: Date = new Date()): string {
  const todayKey = warsawDateKey(now);
  const [y, m, d] = todayKey.split("-").map(Number);
  // Construct noon UTC on that calendar day, then find Warsaw offset and compute local midnight
  const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const offsetMs = warsawOffsetMs(probe);
  const startOfTodayUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMs;
  return new Date(startOfTodayUtcMs).toISOString();
}

/**
 * Exclusive upper bound: start of tomorrow in Europe/Warsaw, as UTC ISO string.
 * Filter: planned_* < this value ≡ date(planned) ≤ current_date (Warsaw).
 */
export function startOfTomorrowWarsawIso(now: Date = new Date()): string {
  const startOfTodayUtcMs = Date.parse(startOfWarsawTodayIso(now));
  return new Date(startOfTodayUtcMs + 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Exclusive upper bound for pending arrivals/departures: the later of Warsaw midnight
 * (end of today) and now + 12h.
 */
export function pendingWindowEndIso(now: Date = new Date()): string {
  const endOfTodayMs = Date.parse(startOfTomorrowWarsawIso(now));
  return new Date(Math.max(endOfTodayMs, now.getTime() + TWELVE_HOURS_MS)).toISOString();
}

/**
 * Inclusive lower bound for handled arrivals/departures.
 * Union of Warsaw calendar today and a rolling 12h lookback (covers overnight shifts).
 */
export function handledWindowStartIso(now: Date = new Date()): string {
  const startOfTodayMs = Date.parse(startOfWarsawTodayIso(now));
  const twelveHoursAgoMs = now.getTime() - TWELVE_HOURS_MS;
  return new Date(Math.min(startOfTodayMs, twelveHoursAgoMs)).toISOString();
}

function warsawOffsetMs(date: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: WARSAW,
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(date);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = tz.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  return (hours * 60 + Math.sign(hours) * minutes) * 60 * 1000;
}
