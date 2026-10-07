import { PARKING_TYPES, type ParkingType } from "./parking-type";

/** Number of day columns with an individually set total price; longer stays add `extra_day_price` per day. */
export const PRICED_DAYS = 14;

export interface PriceListRate {
  /** day_prices[n - 1] = total price for an n-day stay (n = 1..14). */
  day_prices: number[];
  /** Price added per day beyond 14 days. */
  extra_day_price: number;
}

export type PriceListRates = Record<ParkingType, PriceListRate>;

export interface PriceListPeriod {
  /** YYYY-MM-DD */
  valid_from: string;
  /** YYYY-MM-DD, null = open-ended */
  valid_to: string | null;
}

/**
 * Mirrors `public.calculate_total_cost` (the DB is the source of truth when
 * pricing a reservation) — used for previews in the price list editor.
 */
export function priceForDays(rate: PriceListRate, days: number): number {
  const n = Math.max(1, Math.ceil(days));
  if (n <= PRICED_DAYS) return rate.day_prices[n - 1];
  return rate.day_prices[PRICED_DAYS - 1] + (n - PRICED_DAYS) * rate.extra_day_price;
}

/** True when the period covers `date` (YYYY-MM-DD). */
export function periodCovers(period: PriceListPeriod, date: string): boolean {
  return period.valid_from <= date && (period.valid_to === null || period.valid_to >= date);
}

/**
 * The list that prices a check-in on `date`: among covering lists, the one with
 * the latest `valid_from` (same precedence as `public.calculate_total_cost`).
 */
export function activePriceList<T extends PriceListPeriod>(lists: T[], date: string): T | null {
  return lists.reduce<T | null>((best, list) => {
    if (!periodCovers(list, date)) return best;
    return best === null || list.valid_from > best.valid_from ? list : best;
  }, null);
}

export function emptyPriceListRates(): PriceListRates {
  return Object.fromEntries(
    PARKING_TYPES.map((type) => [type, { day_prices: Array<number>(PRICED_DAYS).fill(0), extra_day_price: 0 }])
  ) as PriceListRates;
}
