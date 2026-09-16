import { describe, expect, it } from "vitest";
import { matchDirectionKey, originMatchesKey } from "./direction-match";

describe("matchDirectionKey", () => {
  it("maps a known city alias", () => {
    expect(matchDirectionKey("Londyn")).toBe("london");
    expect(matchDirectionKey("DORTMUND")).toBe("dortmund");
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
  });

  it("does not cross keys", () => {
    expect(originMatchesKey("Dortmund", "london")).toBe(false);
  });
});
