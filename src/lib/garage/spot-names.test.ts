import { describe, expect, it } from "vitest";
import { buildGarageSpotNameMap } from "./spot-names";

describe("buildGarageSpotNameMap", () => {
  it("builds a reservationId -> spot name lookup", () => {
    const map = buildGarageSpotNameMap([
      {
        assignmentId: "a1",
        garageSpotId: "s1",
        garageSpotName: "Garaż 1",
        reservationId: "r1",
        lastName: "Kowalski",
        plannedCheckIn: "2026-09-01T00:00:00Z",
        plannedCheckOut: "2026-09-01T08:00:00Z",
      },
      {
        assignmentId: "a2",
        garageSpotId: "s2",
        garageSpotName: "Wiata 1",
        reservationId: "r2",
        lastName: "Nowak",
        plannedCheckIn: "2026-09-02T00:00:00Z",
        plannedCheckOut: "2026-09-02T08:00:00Z",
      },
    ]);

    expect(map).toEqual({ r1: "Garaż 1", r2: "Wiata 1" });
  });

  it("returns an empty map for no active assignments", () => {
    expect(buildGarageSpotNameMap([])).toEqual({});
  });
});
