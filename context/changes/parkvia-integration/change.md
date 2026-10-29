# Change: ParkVia booking import

- **Status:** implemented (awaiting migration + production env)
- **Spec:** `parkcloud-openapi.yaml` (ParkCloud Operator API v1, downloaded from parkcloud.developer.azure-api.net)

## Decisions (2026-10-07, product owner)

- Price = ParkVia amount (`AmountPaid + AmountDue`), never re-priced from our price lists.
- ParkVia reservations are always paid (`is_paid=true`).
- Sync runs hourly inside the app process (`PARKVIA_SYNC_ENABLED=true`), plus a staff-only manual endpoint.

## Facts learned from the live API

- Auth: `?key=` (parkcloud.net → Operator API) + `Ocp-Apim-Subscription-Key` header. One operator on our account.
- Dates have no offset — car park local time (Europe/Warsaw).
- Rate limit: 10 calls / 60 s per subscription (429 + "Try again in N seconds").
- Unknown booking reference → 403. Events keep ≥ 30 days of history.

## Behaviour

- NEW/AMEND → insert or update fields ParkVia owns (customer, plate, dates, passengers, return-from city, price); notes written once on import.
- CANCEL → `cancelled`, NOSHOW → `no_show` — only while the local stay is `confirmed`; started/finished/locally cancelled stays are left alone.
- A hand-typed reservation with the same plate and Warsaw arrival day is adopted instead of duplicated.
- ParkCloud outage → cursor not advanced (window retried next hour); a booking our DB rejects is logged in `parkvia_sync_state.last_error` and skipped.
- Stays whose departure is before today (Warsaw) are never imported; 24 finished ParkVia reservations from the first import were deleted on 2026-10-07 at the owner's request.
