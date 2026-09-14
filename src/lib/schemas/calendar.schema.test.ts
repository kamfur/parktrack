import { describe, expect, it } from "vitest";
import { calendarRangeQuerySchema, driverShiftWriteSchema } from "./calendar.schema";

describe("calendarRangeQuerySchema", () => {
  it("accepts a valid visible range", () => {
    expect(
      calendarRangeQuerySchema.safeParse({
        from: "2026-09-14T00:00:00+02:00",
        to: "2026-09-15T00:00:00+02:00",
        view: "day",
      }).success
    ).toBe(true);
  });

  it("rejects reversed and excessively long ranges", () => {
    expect(
      calendarRangeQuerySchema.safeParse({
        from: "2026-09-15T00:00:00+02:00",
        to: "2026-09-14T00:00:00+02:00",
        view: "day",
      }).success
    ).toBe(false);
    expect(
      calendarRangeQuerySchema.safeParse({
        from: "2026-01-01T00:00:00+01:00",
        to: "2026-06-01T00:00:00+02:00",
        view: "month",
      }).success
    ).toBe(false);
  });
});

describe("driverShiftWriteSchema", () => {
  it("requires the shift end to be after its start", () => {
    const result = driverShiftWriteSchema.safeParse({
      driver_user_id: "11111111-1111-4111-8111-111111111111",
      starts_at: "2026-09-14T12:00:00+02:00",
      ends_at: "2026-09-14T08:00:00+02:00",
    });
    expect(result.success).toBe(false);
  });
});
