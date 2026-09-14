import { describe, expect, it } from "vitest";
import type { ReservationDto } from "../../types";
import { buildMonthCounts, toCalendarEvent } from "./calendar.service";

function reservation(overrides: Partial<ReservationDto>): ReservationDto {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    first_name: "Jan",
    last_name: "Kowalski",
    license_plate: "KR 123",
    planned_check_in: "2026-09-14T21:30:00Z",
    planned_check_out: "2026-09-15T06:00:00Z",
    status: "confirmed",
    ...overrides,
  } as ReservationDto;
}

describe("buildMonthCounts", () => {
  it("counts occupancy on both Warsaw days when a stay spans midnight, and arrival only on check-in day", () => {
    const rows = [reservation({})];
    const result = buildMonthCounts(rows, "2026-09-13T22:00:00Z", "2026-09-15T22:00:00Z");

    expect(result).toEqual([
      { date: "2026-09-14", arrivals: 1, departures: 0, occupancy: 1 },
      { date: "2026-09-15", arrivals: 0, departures: 1, occupancy: 1 },
    ]);
  });

  it("keeps same-day stays on the check-in Warsaw day only", () => {
    const rows = [
      reservation({
        planned_check_in: "2026-09-14T06:00:00+02:00",
        planned_check_out: "2026-09-14T18:00:00+02:00",
      }),
    ];
    const result = buildMonthCounts(rows, "2026-09-13T22:00:00Z", "2026-09-15T22:00:00Z");
    expect(result).toEqual([
      { date: "2026-09-14", arrivals: 1, departures: 1, occupancy: 1 },
      { date: "2026-09-15", arrivals: 0, departures: 0, occupancy: 0 },
    ]);
  });

  it("allows multiple overlapping reservations", () => {
    const rows = [
      reservation({ id: "1", planned_check_in: "2026-09-14T08:00:00Z" }),
      reservation({ id: "2", planned_check_in: "2026-09-14T09:00:00Z" }),
    ];
    const [day] = buildMonthCounts(rows, "2026-09-13T22:00:00Z", "2026-09-14T22:00:00Z");
    expect(day.occupancy).toBe(2);
  });
});

describe("toCalendarEvent", () => {
  it("classifies arrivals and departures using their planned timestamp", () => {
    const row = reservation({});
    expect(toCalendarEvent(row, "arrival")).toMatchObject({
      kind: "arrival",
      at: row.planned_check_in,
      reservationId: row.id,
    });
    expect(toCalendarEvent(row, "departure")).toMatchObject({
      kind: "departure",
      at: row.planned_check_out,
      reservationId: row.id,
    });
  });
});
