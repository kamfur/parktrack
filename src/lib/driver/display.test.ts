import { describe, expect, it } from "vitest";
import { isNearCheckout, isOverdue } from "./display";

describe("isOverdue", () => {
  it("flags yesterday as overdue relative to a fixed now", () => {
    const now = new Date("2026-09-09T12:00:00+02:00");
    expect(isOverdue("2026-09-08T10:00:00+02:00", now)).toBe(true);
    expect(isOverdue("2026-09-09T08:00:00+02:00", now)).toBe(false);
  });
});

describe("isNearCheckout", () => {
  it("flags checkout within 2 hours", () => {
    const now = new Date("2026-09-09T12:00:00Z");
    expect(isNearCheckout("2026-09-09T13:30:00Z", now)).toBe(true);
    expect(isNearCheckout("2026-09-09T16:00:00Z", now)).toBe(false);
    expect(isNearCheckout("2026-09-09T11:00:00Z", now)).toBe(false);
  });
});
