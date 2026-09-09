import { describe, expect, it } from "vitest";
import { syncIsPaid } from "./driver.service";

describe("syncIsPaid", () => {
  it("is true when paid at arrival", () => {
    expect(syncIsPaid(true, false)).toBe(true);
  });

  it("is true when paid at departure", () => {
    expect(syncIsPaid(false, true)).toBe(true);
  });

  it("is false when neither flag is set", () => {
    expect(syncIsPaid(false, false)).toBe(false);
  });
});
