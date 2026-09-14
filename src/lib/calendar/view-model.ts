import type { CalendarEventDto, DriverShiftDto } from "../../types";
import {
  addUtcDays,
  addUtcMonths,
  warsawDateKey,
  warsawDayBounds,
  warsawHour,
  warsawHourBounds,
  warsawMonthStart,
  warsawWeekStart,
} from "./warsaw-time";

export type CalendarViewMode = "day" | "week" | "month";

export interface CalendarVisibility {
  arrivals: boolean;
  departures: boolean;
  shifts: boolean;
}

export const DEFAULT_CALENDAR_VISIBILITY: CalendarVisibility = {
  arrivals: true,
  departures: true,
  shifts: true,
};

export interface CalendarVisibleRange {
  from: string;
  to: string;
  dateKeys: string[];
}

export function visibleRange(view: CalendarViewMode, anchorDate: string): CalendarVisibleRange {
  if (view === "day") {
    const bounds = warsawDayBounds(anchorDate);
    return { from: bounds.start, to: bounds.end, dateKeys: [anchorDate] };
  }

  if (view === "week") {
    const weekStart = warsawWeekStart(anchorDate);
    const dateKeys = Array.from({ length: 7 }, (_, index) => addUtcDays(weekStart, index));
    return {
      from: warsawDayBounds(dateKeys[0]).start,
      to: warsawDayBounds(addUtcDays(weekStart, 7)).start,
      dateKeys,
    };
  }

  const monthStart = warsawMonthStart(anchorDate);
  const lastDay = addUtcDays(addUtcMonths(monthStart, 1), -1);
  const gridStart = warsawWeekStart(monthStart);
  const gridEnd = addUtcDays(warsawWeekStart(lastDay), 7);
  const dateKeys: string[] = [];
  for (let key = gridStart; key < gridEnd; key = addUtcDays(key, 1)) {
    dateKeys.push(key);
  }
  return {
    from: warsawDayBounds(gridStart).start,
    to: warsawDayBounds(gridEnd).start,
    dateKeys,
  };
}

export function stepAnchorDate(view: CalendarViewMode, anchorDate: string, direction: -1 | 1): string {
  if (view === "month") return addUtcMonths(anchorDate, direction);
  return addUtcDays(anchorDate, view === "day" ? direction : direction * 7);
}

export function isInAnchorMonth(dateKey: string, anchorDate: string): boolean {
  return dateKey.slice(0, 7) === anchorDate.slice(0, 7);
}

export function filterVisibleEvents(events: CalendarEventDto[], visibility: CalendarVisibility): CalendarEventDto[] {
  return events.filter((event) => (event.kind === "arrival" ? visibility.arrivals : visibility.departures));
}

export function filterVisibleShifts(shifts: DriverShiftDto[], visibility: CalendarVisibility): DriverShiftDto[] {
  return visibility.shifts ? shifts : [];
}

export function groupEventsByHour(events: CalendarEventDto[], dateKey: string): CalendarEventDto[][] {
  const buckets: CalendarEventDto[][] = Array.from({ length: 24 }, () => []);
  for (const event of events) {
    const at = new Date(event.at);
    if (warsawDateKey(at) !== dateKey) continue;
    buckets[warsawHour(at)].push(event);
  }
  return buckets;
}

export function shiftsOverlappingHour(shifts: DriverShiftDto[], dateKey: string, hour: number): DriverShiftDto[] {
  const { start, end } = warsawHourBounds(dateKey, hour);
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  return shifts.filter((shift) => Date.parse(shift.starts_at) < endMs && Date.parse(shift.ends_at) > startMs);
}

export function formatDayHeading(dateKey: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    weekday: "short",
    day: "numeric",
    month: "numeric",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

export function formatRangeHeading(view: CalendarViewMode, dateKeys: string[], anchorDate = dateKeys[0]): string {
  if (view === "month") {
    return new Intl.DateTimeFormat("pl-PL", {
      timeZone: "Europe/Warsaw",
      month: "long",
      year: "numeric",
    }).format(new Date(`${warsawMonthStart(anchorDate)}T12:00:00Z`));
  }

  if (view === "day" || dateKeys.length === 1) {
    return new Intl.DateTimeFormat("pl-PL", {
      timeZone: "Europe/Warsaw",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${dateKeys[0]}T12:00:00Z`));
  }

  const start = new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "numeric",
    month: "long",
  }).format(new Date(`${dateKeys[0]}T12:00:00Z`));
  const end = new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateKeys[dateKeys.length - 1]}T12:00:00Z`));
  return `${start} – ${end}`;
}

export function eventDisplayName(event: CalendarEventDto): string {
  return [event.firstName, event.lastName].filter(Boolean).join(" ").trim() || "Rezerwacja";
}
