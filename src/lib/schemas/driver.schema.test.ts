import { describe, expect, it } from "vitest";
import { driverArrivalUpdateSchema, driverCreateReservationSchema, driverDepartureUpdateSchema } from "./driver.schema";

describe("driverArrivalUpdateSchema", () => {
  it("accepts arrival fields", () => {
    const parsed = driverArrivalUpdateSchema.parse({
      passenger_count: 3,
      parking_sector: "A12",
      flight_direction: "Londyn",
      paid_at_arrival: true,
      planned_check_out: "2026-09-12T10:00:00.000Z",
    });
    expect(parsed.passenger_count).toBe(3);
    expect(parsed.paid_at_arrival).toBe(true);
  });

  it("rejects negative passenger_count", () => {
    expect(() => driverArrivalUpdateSchema.parse({ passenger_count: -1 })).toThrow();
  });
});

describe("driverDepartureUpdateSchema", () => {
  it("accepts departure payment and surcharge", () => {
    const parsed = driverDepartureUpdateSchema.parse({
      paid_at_departure: true,
      surcharge_amount: 50,
      notes: "late flight",
    });
    expect(parsed.surcharge_amount).toBe(50);
  });

  it("rejects negative surcharge", () => {
    expect(() => driverDepartureUpdateSchema.parse({ surcharge_amount: -1 })).toThrow();
  });
});

describe("driverCreateReservationSchema", () => {
  const base = {
    last_name: "Kowalski",
    planned_check_in: "2026-09-12T10:00:00.000Z",
    planned_check_out: "2026-09-15T10:00:00.000Z",
  };

  it("defaults to open-air parking and strips price/agency fields", () => {
    const parsed = driverCreateReservationSchema.parse({
      ...base,
      total_cost: 1,
      travel_agency_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(parsed.parking_type).toBe("open_air");
    expect(parsed).not.toHaveProperty("total_cost");
    expect(parsed).not.toHaveProperty("travel_agency_id");
  });

  it("rejects a return not after the arrival and a blank last name", () => {
    expect(driverCreateReservationSchema.safeParse({ ...base, planned_check_out: base.planned_check_in }).success).toBe(
      false
    );
    expect(driverCreateReservationSchema.safeParse({ ...base, last_name: " " }).success).toBe(false);
  });
});
