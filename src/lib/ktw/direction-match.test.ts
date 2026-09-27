import { describe, expect, it } from "vitest";
import { directionMatchesOrigin, matchDirectionKey, originMatchesKey } from "./direction-match";

describe("matchDirectionKey", () => {
  it("maps a known city alias", () => {
    expect(matchDirectionKey("Londyn")).toBe("london");
    expect(matchDirectionKey("DORTMUND")).toBe("dortmund");
    expect(matchDirectionKey("Madera")).toBe("madeira");
  });

  it("matches a substring with extra text", () => {
    expect(matchDirectionKey("Londyn, LO 392")).toBe("london");
  });

  it("skips null, blank, and legacy enum values", () => {
    expect(matchDirectionKey(null)).toBeNull();
    expect(matchDirectionKey(undefined)).toBeNull();
    expect(matchDirectionKey("")).toBeNull();
    expect(matchDirectionKey("   ")).toBeNull();
    expect(matchDirectionKey("departure")).toBeNull();
    expect(matchDirectionKey("arrival")).toBeNull();
    expect(matchDirectionKey("Departure")).toBeNull();
  });

  it("returns null when no alias matches", () => {
    expect(matchDirectionKey("Narnia")).toBeNull();
    expect(matchDirectionKey("LO 392")).toBeNull();
  });

  it("does not treat IATA fragments inside longer city names as a hit", () => {
    expect(matchDirectionKey("Dublin")).toBe("dublin");
    expect(matchDirectionKey("Narnia")).toBeNull();
  });
});

describe("originMatchesKey", () => {
  it("matches board origin labels for the same key", () => {
    expect(originMatchesKey("London Luton", "london")).toBe(true);
    expect(originMatchesKey("Luton", "london")).toBe(true);
    expect(originMatchesKey("Dortmund", "dortmund")).toBe(true);
    expect(originMatchesKey("Madera", "madeira")).toBe(true);
  });

  it("does not cross keys", () => {
    expect(originMatchesKey("Dortmund", "london")).toBe(false);
  });
});

describe("directionMatchesOrigin", () => {
  it("uses aliases for codes and foreign spellings", () => {
    expect(directionMatchesOrigin("LTN", "Londyn - Luton")).toBe(true);
    expect(directionMatchesOrigin("Stansted", "Londyn - Stansted")).toBe(true);
    expect(directionMatchesOrigin("Napoli", "Neapol")).toBe(true);
  });

  it("matches the Polish board names of aliased cities", () => {
    expect(directionMatchesOrigin("Dubrownik", "Dubrownik")).toBe(true);
    expect(directionMatchesOrigin("Katania", "Katania")).toBe(true);
    expect(directionMatchesOrigin("Neapol", "Neapol")).toBe(true);
  });

  it("falls back to the board place name for cities outside the alias table", () => {
    expect(directionMatchesOrigin("Bodrum", "Bodrum")).toBe(true);
    expect(directionMatchesOrigin("hurghada, W6 123", "Hurghada")).toBe(true);
    expect(directionMatchesOrigin("Kos", "Kos")).toBe(true);
    expect(directionMatchesOrigin("Braszow", "Braszów - Ghimbav")).toBe(true);
    expect(directionMatchesOrigin("Sharm el Sheikh", "Sharm El Sheikh")).toBe(true);
  });

  it("matches a whole-word part of a longer board name", () => {
    expect(directionMatchesOrigin("Palma", "Palma De Mallorca")).toBe(true);
    expect(directionMatchesOrigin("Keflavik", "Reykjavik - Keflavik")).toBe(true);
    expect(directionMatchesOrigin("Girona", "Barcelona (Girona)")).toBe(true);
  });

  it("does not match fragments or different cities", () => {
    expect(directionMatchesOrigin("Kosice", "Kos")).toBe(false);
    expect(directionMatchesOrigin("Bodrum", "Dalaman")).toBe(false);
    expect(directionMatchesOrigin("De", "Palma De Mallorca")).toBe(false);
    expect(directionMatchesOrigin("Marsa", "Marsa Alam")).toBe(true);
    expect(directionMatchesOrigin("Dortmund", "Londyn - Luton")).toBe(false);
  });

  it("skips empty and legacy directions", () => {
    expect(directionMatchesOrigin(null, "Bodrum")).toBe(false);
    expect(directionMatchesOrigin("  ", "Bodrum")).toBe(false);
    expect(directionMatchesOrigin("arrival", "Arrival City")).toBe(false);
  });
});
