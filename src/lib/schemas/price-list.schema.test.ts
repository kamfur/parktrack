import { describe, expect, it } from "vitest";
import { savePriceListSchema } from "./price-list.schema";

const rate = { day_prices: Array.from({ length: 14 }, (_, i) => 40 + i * 10), extra_day_price: 10 };
const valid = {
  valid_from: "2027-02-01",
  valid_to: "2027-05-15",
  rates: { open_air: rate, carport: rate, garage: rate },
};

describe("savePriceListSchema", () => {
  it("accepts a bounded period with all three rate rows", () => {
    expect(savePriceListSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts an open-ended period", () => {
    expect(savePriceListSchema.safeParse({ ...valid, valid_to: null }).success).toBe(true);
  });

  it("rejects an end date before the start date", () => {
    expect(savePriceListSchema.safeParse({ ...valid, valid_to: "2027-01-31" }).success).toBe(false);
  });

  it("requires exactly 14 day prices", () => {
    const short = { ...rate, day_prices: rate.day_prices.slice(0, 13) };
    expect(savePriceListSchema.safeParse({ ...valid, rates: { ...valid.rates, garage: short } }).success).toBe(false);
  });

  it("rejects negative or non-numeric prices", () => {
    const negative = { ...rate, extra_day_price: -1 };
    expect(savePriceListSchema.safeParse({ ...valid, rates: { ...valid.rates, carport: negative } }).success).toBe(
      false
    );
    const withNaN = { ...rate, day_prices: [NaN, ...rate.day_prices.slice(1)] };
    expect(savePriceListSchema.safeParse({ ...valid, rates: { ...valid.rates, open_air: withNaN } }).success).toBe(
      false
    );
  });

  it("requires a row for every parking type", () => {
    const twoRows = { open_air: rate, carport: rate };
    expect(savePriceListSchema.safeParse({ ...valid, rates: twoRows }).success).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(savePriceListSchema.safeParse({ ...valid, valid_from: "01.02.2027" }).success).toBe(false);
  });
});
