import { describe, expect, it } from "vitest";
import {
  datetimeLocalToIso,
  driverArrivalFormSchema,
  driverDepartureFormSchema,
  isoToDatetimeLocal,
} from "./driver-form.schema";

describe("driverArrivalFormSchema", () => {
  it("accepts paid arrival with passengers and sector", () => {
    const parsed = driverArrivalFormSchema.parse({
      planned_check_out: "2026-09-10T14:30",
      flight_direction: "Londyn",
      passenger_count: 2,
      parking_sector: "B3",
      paid_at_arrival: true,
    });
    expect(parsed.passenger_count).toBe(2);
    expect(parsed.paid_at_arrival).toBe(true);
  });

  it("accepts null passenger_count", () => {
    const parsed = driverArrivalFormSchema.parse({
      passenger_count: null,
      paid_at_arrival: false,
    });
    expect(parsed.passenger_count).toBeNull();
  });
});

describe("driverDepartureFormSchema", () => {
  it("accepts surcharge and notes", () => {
    const parsed = driverDepartureFormSchema.parse({
      notes: "dopłata za dzień",
      paid_at_departure: true,
      surcharge_amount: 40,
      planned_check_out: "2026-09-11T10:00",
    });
    expect(parsed.surcharge_amount).toBe(40);
  });

  it("rejects negative surcharge", () => {
    expect(() =>
      driverDepartureFormSchema.parse({
        paid_at_departure: false,
        surcharge_amount: -1,
      })
    ).toThrow();
  });
});

describe("datetime helpers", () => {
  it("round-trips a stable local datetime string shape", () => {
    const iso = datetimeLocalToIso("2026-09-10T14:30");
    expect(iso).toBeTruthy();
    expect(isoToDatetimeLocal(iso)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("returns undefined for empty datetime-local", () => {
    expect(datetimeLocalToIso("")).toBeUndefined();
    expect(datetimeLocalToIso(undefined)).toBeUndefined();
  });
});
