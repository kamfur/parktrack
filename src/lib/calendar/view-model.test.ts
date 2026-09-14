import { describe, expect, it } from "vitest";
import type { CalendarEventDto, DriverShiftDto } from "../../types";
import {
  filterVisibleEvents,
  filterVisibleShifts,
  groupEventsByHour,
  shiftsOverlappingHour,
  stepAnchorDate,
  visibleRange,
} from "./view-model";

function event(overrides: Partial<CalendarEventDto>): CalendarEventDto {
  return {
    kind: "arrival",
    at: "2026-09-14T21:30:00Z",
    reservationId: "res-1",
    firstName: "Jan",
    lastName: "Kowalski",
    licensePlate: "KR 123",
    status: "confirmed",
    ...overrides,
  };
}

function shift(overrides: Partial<DriverShiftDto>): DriverShiftDto {
  return {
    id: "shift-1",
    driver_user_id: "driver-1",
    starts_at: "2026-09-14T06:00:00+02:00",
    ends_at: "2026-09-14T14:00:00+02:00",
    created_at: "2026-09-14T05:00:00+02:00",
    ...overrides,
  };
}

describe("visibleRange", () => {
  it("returns Warsaw day bounds for day view", () => {
    expect(visibleRange("day", "2026-09-14")).toEqual({
      from: "2026-09-14T00:00:00+02:00",
      to: "2026-09-15T00:00:00+02:00",
      dateKeys: ["2026-09-14"],
    });
  });

  it("returns the Monday-Sunday Warsaw week containing the anchor", () => {
    const range = visibleRange("week", "2026-09-16");
    expect(range.dateKeys).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
    expect(range.from).toBe("2026-09-14T00:00:00+02:00");
    expect(range.to).toBe("2026-09-21T00:00:00+02:00");
  });
});

describe("stepAnchorDate", () => {
  it("moves one day or one week", () => {
    expect(stepAnchorDate("day", "2026-09-14", 1)).toBe("2026-09-15");
    expect(stepAnchorDate("week", "2026-09-14", -1)).toBe("2026-09-07");
  });
});

describe("visibility filters", () => {
  const events = [
    event({ kind: "arrival", reservationId: "a" }),
    event({ kind: "departure", reservationId: "d", at: "2026-09-15T06:00:00Z" }),
  ];
  const shifts = [shift({})];

  it("keeps only the enabled event layers", () => {
    expect(filterVisibleEvents(events, { arrivals: true, departures: false, shifts: true })).toEqual([events[0]]);
    expect(filterVisibleEvents(events, { arrivals: false, departures: true, shifts: true })).toEqual([events[1]]);
    expect(filterVisibleEvents(events, { arrivals: false, departures: false, shifts: true })).toEqual([]);
  });

  it("hides every shift when the shift layer is off", () => {
    expect(filterVisibleShifts(shifts, { arrivals: true, departures: true, shifts: false })).toEqual([]);
    expect(filterVisibleShifts(shifts, { arrivals: true, departures: true, shifts: true })).toEqual(shifts);
  });
});

describe("groupEventsByHour", () => {
  it("places events into the Warsaw hour of their planned timestamp", () => {
    const events = [
      event({ reservationId: "late", at: "2026-09-14T21:30:00Z" }),
      event({ reservationId: "morning", at: "2026-09-14T06:15:00+02:00" }),
      event({ reservationId: "other-day", at: "2026-09-15T06:00:00+02:00" }),
    ];

    const buckets = groupEventsByHour(events, "2026-09-14");
    expect(buckets[23].map((item) => item.reservationId)).toEqual(["late"]);
    expect(buckets[6].map((item) => item.reservationId)).toEqual(["morning"]);
    expect(buckets.flat()).toHaveLength(2);
  });
});

describe("shiftsOverlappingHour", () => {
  it("includes a shift in every overlapping Warsaw hour", () => {
    const rows = [shift({})];
    expect(shiftsOverlappingHour(rows, "2026-09-14", 5)).toHaveLength(0);
    expect(shiftsOverlappingHour(rows, "2026-09-14", 6)).toHaveLength(1);
    expect(shiftsOverlappingHour(rows, "2026-09-14", 13)).toHaveLength(1);
    expect(shiftsOverlappingHour(rows, "2026-09-14", 14)).toHaveLength(0);
  });
});
