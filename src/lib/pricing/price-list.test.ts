import { describe, expect, it } from "vitest";
import { activePriceList, emptyPriceListRates, priceForDays } from "./price-list";

const rate = {
  day_prices: [40, 70, 95, 115, 135, 150, 165, 180, 195, 210, 220, 230, 240, 250],
  extra_day_price: 10,
};

describe("priceForDays", () => {
  it("uses the individually set total for 1..14 days", () => {
    expect(priceForDays(rate, 1)).toBe(40);
    expect(priceForDays(rate, 7)).toBe(165);
    expect(priceForDays(rate, 14)).toBe(250);
  });

  it("adds the per-day price for every day beyond 14", () => {
    expect(priceForDays(rate, 15)).toBe(260);
    expect(priceForDays(rate, 20)).toBe(310);
  });

  it("treats a partial day as a full day and never prices below one day", () => {
    expect(priceForDays(rate, 2.1)).toBe(95);
    expect(priceForDays(rate, 0)).toBe(40);
  });
});

describe("activePriceList", () => {
  const base = { id: "base", valid_from: "2026-09-26", valid_to: null };
  const spring = { id: "spring", valid_from: "2027-02-01", valid_to: "2027-05-15" };

  it("uses the open-ended base list outside a bounded period", () => {
    expect(activePriceList([base, spring], "2026-12-24")?.id).toBe("base");
    expect(activePriceList([base, spring], "2027-05-16")?.id).toBe("base");
  });

  it("lets the bounded period with the later start win while it lasts (inclusive bounds)", () => {
    expect(activePriceList([base, spring], "2027-02-01")?.id).toBe("spring");
    expect(activePriceList([spring, base], "2027-05-15")?.id).toBe("spring");
  });

  it("returns null when no list covers the date", () => {
    expect(activePriceList([base, spring], "2026-09-25")).toBeNull();
  });
});

describe("emptyPriceListRates", () => {
  it("has 14 zeroed day prices for each parking type", () => {
    const rates = emptyPriceListRates();
    expect(Object.keys(rates)).toEqual(["open_air", "carport", "garage"]);
    expect(rates.garage.day_prices).toHaveLength(14);
    expect(rates.garage.extra_day_price).toBe(0);
  });
});
