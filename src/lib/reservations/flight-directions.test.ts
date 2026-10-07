import { describe, expect, it } from "vitest";
import { filterFlightDirections, uniqueFlightDirections } from "./flight-directions";

describe("uniqueFlightDirections", () => {
  it("keeps distinct saved destinations, ignoring blanks and legacy enum values", () => {
    expect(
      uniqueFlightDirections(["Londyn", " londyn ", "", null, "Dortmund", "departure", "arrival", "Londyn, LO 392"])
    ).toEqual(["Dortmund", "Londyn", "Londyn, LO 392"]);
  });
});

describe("filterFlightDirections", () => {
  const options = ["Dortmund", "Londyn", "Londyn, LO 392"];

  it("returns every option when the query is empty", () => {
    expect(filterFlightDirections(options, "  ")).toEqual(options);
  });

  it("matches saved directions regardless of case", () => {
    expect(filterFlightDirections(options, "lon")).toEqual(["Londyn", "Londyn, LO 392"]);
  });
});
