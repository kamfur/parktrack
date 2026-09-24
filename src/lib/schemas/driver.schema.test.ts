import { describe, expect, it } from "vitest";
import { driverArrivalUpdateSchema, driverDepartureUpdateSchema } from "./driver.schema";

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
