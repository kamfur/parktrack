---
change_id: price-lists
title: Period-based price lists (1–14 days per parking type)
status: implemented
created: 2026-09-26
updated: 2026-09-26
archived_at: null
---

## Notes

Pricing policy change (user request, 2026-09-26): prices are set individually per stay length instead of a per-day rate.

Decisions:
- A price list has a validity period (`valid_from`, optional `valid_to` = open-ended) and one row per parking type: parking (`open_air`), wiata (`carport`), garaż (`garage`).
- Each row: total price for a 1..14 day stay (`day_prices[14]`) + `extra_day_price` added per day beyond 14. Days = ceil(24h periods), minimum 1 (unchanged from the old `calculate_total_cost`).
- The list covering the check-in date (Europe/Warsaw) with the latest `valid_from` wins — an open-ended base list plus bounded overrides (e.g. 1 Feb – 15 May); `valid_from` is unique so precedence is deterministic.
- `reservations.parking_type` gains `carport`, so a reservation is priced (and auto-assigned) as garage or carport explicitly. Existing `garage` reservations assigned to a carport spot were backfilled to `carport` without re-pricing.
- Pricing stays in the DB (`calculate_total_cost(check_in, check_out, parking_type)` + cost trigger, which now also re-prices on parking_type changes). Raises `NO_PRICE_LIST` → API 422 when no list covers the date.
- Superseded and removed: `pricing_rules` table, `garage_spots.price_per_day`, `daily_rate` setting. The base list was seeded from the old `pricing_rules` totals for all three types, so prices don't change at deploy.
- Invoice line is now one service at the reservation total (with parking type + days in the description); `daily_rate_snapshot` stores total / days for reference.

Known gaps (not in scope):
- Manual garage swap (`/api/garage-assignments`) may move a reservation to a spot of the other covered type; the booked price and `parking_type` are kept.
- The reservation edit form doesn't change parking type (no reallocation flow on edit).

Verification (2026-09-26): unit/integration tests, typecheck, build. Migration not yet applied — local Docker wasn't running and `.env` targets the remote project.
