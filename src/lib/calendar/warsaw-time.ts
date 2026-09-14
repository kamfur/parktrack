const WARSAW = "Europe/Warsaw";
const DAY_MS = 24 * 60 * 60 * 1000;

export function warsawDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WARSAW,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function offsetAt(date: Date): string {
  const value =
    new Intl.DateTimeFormat("en", {
      timeZone: WARSAW,
      timeZoneName: "shortOffset",
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT+1";
  const match = value.match(/GMT([+-])(\d+)(?::(\d+))?/);
  const sign = match?.[1] ?? "+";
  const hours = String(match?.[2] ?? "1").padStart(2, "0");
  const minutes = String(match?.[3] ?? "0").padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

export function addUtcDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function warsawDayBounds(dateKey: string): { start: string; end: string } {
  const nextDateKey = addUtcDays(dateKey, 1);
  const utcMidnight = new Date(`${dateKey}T00:00:00Z`);
  const nextUtcMidnight = new Date(`${nextDateKey}T00:00:00Z`);
  return {
    start: `${dateKey}T00:00:00${offsetAt(utcMidnight)}`,
    end: `${nextDateKey}T00:00:00${offsetAt(nextUtcMidnight)}`,
  };
}

export function dateKeysInRange(from: string, to: string): string[] {
  const startKey = warsawDateKey(new Date(from));
  const endExclusive = new Date(to);
  const keys: string[] = [];
  for (let key = startKey; Date.parse(warsawDayBounds(key).start) < endExclusive.getTime(); key = addUtcDays(key, 1)) {
    keys.push(key);
    if (keys.length > Math.ceil((Date.parse(to) - Date.parse(from)) / DAY_MS) + 2) break;
  }
  return keys;
}

const WEEKDAYS_MON0 = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function warsawHour(date: Date): number {
  const hour =
    new Intl.DateTimeFormat("en-GB", {
      timeZone: WARSAW,
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .find((part) => part.type === "hour")?.value ?? "0";
  return Number(hour);
}

export function warsawHourBounds(dateKey: string, hour: number): { start: string; end: string } {
  const startMs = Date.parse(warsawDayBounds(dateKey).start) + hour * 60 * 60 * 1000;
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(startMs + 60 * 60 * 1000).toISOString(),
  };
}

export function warsawWeekdayMon0(dateKey: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: WARSAW,
    weekday: "short",
  }).format(new Date(`${dateKey}T12:00:00Z`));
  return WEEKDAYS_MON0.indexOf(weekday as (typeof WEEKDAYS_MON0)[number]);
}

export function warsawWeekStart(dateKey: string): string {
  return addUtcDays(dateKey, -warsawWeekdayMon0(dateKey));
}

export function warsawTimeLabel(date: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: WARSAW,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
