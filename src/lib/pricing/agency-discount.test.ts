import { describe, expect, it } from "vitest";
import { applyAgencyDiscount } from "./agency-discount";

describe("applyAgencyDiscount", () => {
  it.each([
    [30, 15, 25.5],
    [50, 15, 42.5],
    [99.99, 10, 89.99],
    [100, 0, 100],
    [100, 100, 0],
    [33.33, 12.5, 29.16],
    [10.01, 50, 5.01],
  ])("%s PLN − %s%% = %s PLN", (base, pct, expected) => {
    expect(applyAgencyDiscount(base, pct)).toBe(expected);
  });
});
