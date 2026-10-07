import { describe, expect, it } from "vitest";
import { computeGarageOptimizationSuggestions, type OptimizationSpot } from "./garage-optimization.service";

function assignment(lastName: string, checkIn: string, checkOut: string) {
  return { reservationLastName: lastName, checkIn: new Date(checkIn), checkOut: new Date(checkOut) };
}

describe("computeGarageOptimizationSuggestions", () => {
  it("suggests moving a reservation that fits inside another spot's largest idle gap", () => {
    const spots: OptimizationSpot[] = [
      {
        spotId: "s1",
        spotName: "Garaż 1",
        assignments: [
          assignment("Kowalski", "2026-09-01T00:00:00Z", "2026-09-01T08:00:00Z"),
          // 48h idle gap before the next occupancy — well beyond the 10h buffer.
          assignment("Nowak", "2026-09-03T08:00:00Z", "2026-09-03T16:00:00Z"),
        ],
      },
      {
        spotId: "s2",
        spotName: "Wiata 1",
        // Fits comfortably inside s1's gap with buffer on both sides.
        assignments: [assignment("Zieliński", "2026-09-01T20:00:00Z", "2026-09-02T04:00:00Z")],
      },
    ];

    const suggestions = computeGarageOptimizationSuggestions(spots);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].garageSpotId).toBe("s1");
    expect(suggestions[0].description).toContain("Garaż 1");
    expect(suggestions[0].description).toContain("Zieliński");
    expect(suggestions[0].description).toContain("Wiata 1");
  });

  it("suggests nothing when a spot's largest gap is only the mandatory buffer", () => {
    const spots: OptimizationSpot[] = [
      {
        spotId: "s1",
        spotName: "Garaż 1",
        assignments: [
          assignment("Kowalski", "2026-09-01T00:00:00Z", "2026-09-01T08:00:00Z"),
          // Exactly 10h gap — this is the buffer itself, not downtime worth reporting.
          assignment("Nowak", "2026-09-01T18:00:00Z", "2026-09-02T02:00:00Z"),
        ],
      },
    ];

    expect(computeGarageOptimizationSuggestions(spots)).toEqual([]);
  });

  it("suggests nothing when no other spot's reservation fits inside the gap with the buffer preserved", () => {
    const spots: OptimizationSpot[] = [
      {
        spotId: "s1",
        spotName: "Garaż 1",
        assignments: [
          assignment("Kowalski", "2026-09-01T00:00:00Z", "2026-09-01T08:00:00Z"),
          assignment("Nowak", "2026-09-03T08:00:00Z", "2026-09-03T16:00:00Z"),
        ],
      },
      {
        spotId: "s2",
        spotName: "Wiata 1",
        // Starts too early relative to the gap start + buffer — doesn't fit.
        assignments: [assignment("Zieliński", "2026-09-01T10:00:00Z", "2026-09-01T18:00:00Z")],
      },
    ];

    expect(computeGarageOptimizationSuggestions(spots)).toEqual([]);
  });

  it("suggests nothing for a spot with fewer than two assignments (no internal gap)", () => {
    const spots: OptimizationSpot[] = [
      {
        spotId: "s1",
        spotName: "Garaż 1",
        assignments: [assignment("Kowalski", "2026-09-01T00:00:00Z", "2026-09-01T08:00:00Z")],
      },
    ];

    expect(computeGarageOptimizationSuggestions(spots)).toEqual([]);
  });
});
