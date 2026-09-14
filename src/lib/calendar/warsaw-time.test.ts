import { describe, expect, it } from "vitest";
import { dateKeysInRange, warsawDateKey, warsawDayBounds, warsawHour, warsawWeekStart } from "./warsaw-time";

describe("Warsaw calendar helpers", () => {
  it("maps instants around Warsaw midnight to the correct day", () => {
    expect(warsawDateKey(new Date("2026-09-13T21:59:59Z"))).toBe("2026-09-13");
    expect(warsawDateKey(new Date("2026-09-13T22:00:00Z"))).toBe("2026-09-14");
  });

  it("uses different offsets at DST boundaries", () => {
    expect(warsawDayBounds("2026-03-29")).toEqual({
      start: "2026-03-29T00:00:00+01:00",
      end: "2026-03-30T00:00:00+02:00",
    });
  });

  it("enumerates each Warsaw date in a half-open range", () => {
    expect(dateKeysInRange("2026-09-13T22:00:00Z", "2026-09-16T22:00:00Z")).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
    ]);
  });

  it("reads the Warsaw hour from an instant", () => {
    expect(warsawHour(new Date("2026-09-14T21:30:00Z"))).toBe(23);
    expect(warsawHour(new Date("2026-09-13T22:00:00Z"))).toBe(0);
  });

  it("starts the week on Monday in Warsaw", () => {
    expect(warsawWeekStart("2026-09-14")).toBe("2026-09-14");
    expect(warsawWeekStart("2026-09-16")).toBe("2026-09-14");
    expect(warsawWeekStart("2026-09-20")).toBe("2026-09-14");
  });
});
