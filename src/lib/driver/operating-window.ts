/**
 * Operating-window helpers for driver arrival/departure lists.
 * Window rule (v1): calendar date in Europe/Warsaw ≤ today (overdue any past day + all of today).
 */

const WARSAW = "Europe/Warsaw";

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

/**
 * Exclusive upper bound: start of tomorrow in Europe/Warsaw, as UTC ISO string.
 * Filter: planned_* < this value ≡ date(planned) ≤ current_date (Warsaw).
 */
export function startOfTomorrowWarsawIso(now: Date = new Date()): string {
  const todayKey = warsawDateKey(now);
  const [y, m, d] = todayKey.split("-").map(Number);
  // Construct noon UTC on that calendar day, then find Warsaw offset and compute local midnight+1d
  const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const offsetMs = warsawOffsetMs(probe);
  const startOfTodayUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMs;
  const startOfTomorrowUtcMs = startOfTodayUtcMs + 24 * 60 * 60 * 1000;
  return new Date(startOfTomorrowUtcMs).toISOString();
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
