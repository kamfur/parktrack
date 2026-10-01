import { describe, expect, it } from "vitest";
import type { CalendarEventDto, DriverShiftDto } from "../../types";
import {
  filterVisibleEvents,
  filterVisibleShifts,
  groupEventsByHour,
  layoutShiftsForDay,
  shiftsOverlappingHour,
  shiftSpanForDay,
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
    handled: false,
    parkingType: "open_air",
    flightDirection: null,
    keysLeft: false,
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

  it("pads the month grid from Monday before the 1st through Sunday after the last day", () => {
    const range = visibleRange("month", "2026-09-16");
    expect(range.dateKeys[0]).toBe("2026-08-31");
    expect(range.dateKeys.at(-1)).toBe("2026-10-04");
    expect(range.dateKeys).toHaveLength(35);
    expect(range.from).toBe("2026-08-31T00:00:00+02:00");
    expect(range.to).toBe("2026-10-05T00:00:00+02:00");
  });
});

describe("stepAnchorDate", () => {
  it("moves one day, week, or month", () => {
    expect(stepAnchorDate("day", "2026-09-14", 1)).toBe("2026-09-15");
    expect(stepAnchorDate("week", "2026-09-14", -1)).toBe("2026-09-07");
    expect(stepAnchorDate("month", "2026-09-16", 1)).toBe("2026-10-16");
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

describe("shiftSpanForDay", () => {
  it("returns the whole Warsaw-hour span for a shift on that day", () => {
    expect(shiftSpanForDay(shift({}), "2026-09-14")).toEqual({ startHour: 6, endHour: 14 });
  });

  it("clips an overnight shift to each calendar day", () => {
    const overnight = shift({
      starts_at: "2026-09-14T22:00:00+02:00",
      ends_at: "2026-09-15T06:00:00+02:00",
    });
    expect(shiftSpanForDay(overnight, "2026-09-14")).toEqual({ startHour: 22, endHour: 24 });
    expect(shiftSpanForDay(overnight, "2026-09-15")).toEqual({ startHour: 0, endHour: 6 });
    expect(shiftSpanForDay(overnight, "2026-09-16")).toBeNull();
  });
});

describe("layoutShiftsForDay", () => {
  it("places overlapping shifts in adjacent lanes", () => {
    const rows = layoutShiftsForDay(
      [
        shift({ id: "a", starts_at: "2026-09-14T06:00:00+02:00", ends_at: "2026-09-14T14:00:00+02:00" }),
        shift({ id: "b", starts_at: "2026-09-14T10:00:00+02:00", ends_at: "2026-09-14T18:00:00+02:00" }),
      ],
      "2026-09-14"
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((item) => [item.shift.id, item.lane, item.laneCount])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
    ]);
  });

  it("reuses a lane when shifts do not overlap", () => {
    const rows = layoutShiftsForDay(
      [
        shift({ id: "morning", starts_at: "2026-09-14T06:00:00+02:00", ends_at: "2026-09-14T10:00:00+02:00" }),
        shift({ id: "evening", starts_at: "2026-09-14T12:00:00+02:00", ends_at: "2026-09-14T18:00:00+02:00" }),
      ],
      "2026-09-14"
    );
    expect(rows.map((item) => [item.shift.id, item.lane, item.laneCount])).toEqual([
      ["morning", 0, 1],
      ["evening", 0, 1],
    ]);
  });
});
