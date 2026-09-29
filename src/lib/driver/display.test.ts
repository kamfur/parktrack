import { describe, expect, it } from "vitest";
import { amountDue, flightDirectionLabel, garageSpotLabel, isAgencyPaid, isNearCheckout, isOverdue } from "./display";

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

  it("labels a carport reservation as Wiata", () => {
    expect(garageSpotLabel("carport", "W1")).toBe("Wiata: W1");
  });
});

describe("amountDue", () => {
  it("returns the total for an unpaid reservation", () => {
    expect(amountDue({ is_paid: false, total_cost: 210, surcharge_amount: null })).toBe(210);
  });

  it("adds a recorded surcharge", () => {
    expect(amountDue({ is_paid: false, total_cost: 210, surcharge_amount: 40 })).toBe(250);
  });

  it("returns null once paid (e.g. at arrival)", () => {
    expect(amountDue({ is_paid: true, total_cost: 210, surcharge_amount: null })).toBeNull();
  });

  it("returns null when there is nothing to collect", () => {
    expect(amountDue({ is_paid: false, total_cost: 0, surcharge_amount: null })).toBeNull();
  });
});

describe("isAgencyPaid", () => {
  it("is true only when a travel agency pays", () => {
    expect(isAgencyPaid({ travel_agency_id: "11111111-1111-4111-8111-111111111111" })).toBe(true);
    expect(isAgencyPaid({ travel_agency_id: null })).toBe(false);
  });

  it("agency stays show nothing to collect (the DB keeps them paid)", () => {
    expect(amountDue({ is_paid: true, total_cost: 120, surcharge_amount: null })).toBeNull();
  });
});
