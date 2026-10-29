/**
 * Price after the travel-agency discount, rounded to grosze — mirrors
 * `round(price × (1 − pct/100), 2)` in `public.update_reservation_cost` (the DB stays authoritative).
 */
export function applyAgencyDiscount(baseCost: number, discountPct: number): number {
  // Work in grosze to avoid float drift (e.g. 42.5 × 0.85).
  return Math.round((Math.round(baseCost * 100) * (100 - discountPct)) / 100) / 100;
}
