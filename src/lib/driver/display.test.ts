import { describe, expect, it } from "vitest";
import { flightDirectionLabel, garageSpotLabel, isNearCheckout, isOverdue } from "./display";

describe("isOverdue", () => {
  it("flags yesterday as overdue relative to a fixed now", () => {
    const now = new Date("2026-09-09T12:00:00+02:00");
    expect(isOverdue("2026-09-08T10:00:00+02:00", now)).toBe(true);
    expect(isOverdue("2026-09-09T08:00:00+02:00", now)).toBe(false);
  });
});

describe("flightDirectionLabel", () => {
  it("maps legacy enum values and returns free text as-is", () => {
    expect(flightDirectionLabel("departure")).toBe("Wylot");
    expect(flightDirectionLabel("arrival")).toBe("Przylot");
    expect(flightDirectionLabel("Londyn")).toBe("Londyn");
    expect(flightDirectionLabel(null)).toBeNull();
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

describe("garageSpotLabel", () => {
  it("returns null for a regular (open_air) reservation", () => {
    expect(garageSpotLabel("open_air", "Garaż 1")).toBeNull();
  });

  it("returns null when the parking type is garage but no spot name is known yet", () => {
    expect(garageSpotLabel("garage", null)).toBeNull();
    expect(garageSpotLabel("garage", undefined)).toBeNull();
  });

  it("returns a formatted label for a garage reservation with a known spot", () => {
    expect(garageSpotLabel("garage", "Garaż 1")).toBe("Garaż: Garaż 1");
  });
});
