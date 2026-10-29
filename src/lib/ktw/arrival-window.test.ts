import { describe, expect, it } from "vitest";
import { ARRIVAL_WINDOW_MS, isWithinArrivalWindow } from "./arrival-window";

describe("isWithinArrivalWindow", () => {
  const planned = "2026-09-16T12:00:00.000Z";

  it("includes scheduled times inside ±3h", () => {
    expect(isWithinArrivalWindow("2026-09-16T12:00:00.000Z", planned)).toBe(true);
    expect(isWithinArrivalWindow("2026-09-16T09:00:00.000Z", planned)).toBe(true);
    expect(isWithinArrivalWindow("2026-09-16T15:00:00.000Z", planned)).toBe(true);
  });

  it("excludes scheduled times outside ±3h", () => {
    expect(isWithinArrivalWindow("2026-09-16T08:59:59.000Z", planned)).toBe(false);
    expect(isWithinArrivalWindow("2026-09-16T15:00:01.000Z", planned)).toBe(false);
  });

  it("rejects invalid timestamps", () => {
    expect(isWithinArrivalWindow("not-a-date", planned)).toBe(false);
    expect(isWithinArrivalWindow(planned, "nope")).toBe(false);
  });

  it("treats Warsaw-offset ISO as the same instant as UTC", () => {
    expect(isWithinArrivalWindow("2026-09-16T14:00:00+02:00", "2026-09-16T12:00:00.000Z")).toBe(true);
    expect(isWithinArrivalWindow("2026-09-16T17:00:01+02:00", "2026-09-16T12:00:00.000Z")).toBe(false);
  });

  it("keeps elapsed ±3h across the 2026 EU spring DST jump", () => {
    // 2026-03-29 01:00 UTC: Europe/Warsaw CET → CEST.
    const plannedBefore = "2026-03-29T00:30:00+01:00";
    const inside = new Date(Date.parse(plannedBefore) + ARRIVAL_WINDOW_MS).toISOString();
    const outside = new Date(Date.parse(plannedBefore) + ARRIVAL_WINDOW_MS + 1000).toISOString();
    expect(isWithinArrivalWindow(inside, plannedBefore)).toBe(true);
    expect(isWithinArrivalWindow(outside, plannedBefore)).toBe(false);
  });
});
