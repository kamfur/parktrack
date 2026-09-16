---
date: 2026-09-16T13:55:34+02:00
researcher: kamfur
git_commit: d7a576e514cfffdeae7cb1ae0463545bf1dd1fb2
branch: feat/driver-module
repository: kamfur/parktrack
topic: "Connect KTW scheduled arrival hours to staff and driver return views using saved flight direction and planned return (±3h), without changing list or check-out contracts"
tags: [research, codebase, returns, departures, flight-direction, check-out, ktw]
status: complete
last_updated: 2026-09-16
last_updated_by: kamfur
---

# Research: Arrivals timeline connect

**Date**: 2026-09-16T13:55:34+02:00
**Researcher**: kamfur
**Git Commit**: d7a576e514cfffdeae7cb1ae0463545bf1dd1fb2
**Branch**: feat/driver-module
**Repository**: kamfur/parktrack

## Research Question

How do staff and driver return (departure) views work today, where are flight direction and estimated return stored, and what can we add so those views show scheduled KTW arrival hours in a ± about 3h window around `planned_check_out` — all candidates, no single-flight pick — without changing return-list or check-out contracts (`prd-v4` FR-001–005)?

## Summary

Return lists already exist for both roles. They are **departures**: `status = in_progress` and `planned_check_out` before Warsaw tomorrow. Staff sees them on `/` (`POST /api/reservations/departures` → bare `ReservationDto[]`). Driver sees them on `/kierowca` (`GET /api/driver/departures` → `{ data, handled }`).

The inputs the PRD needs already live on the reservation row:

- **Direction:** `flight_direction` (`text`, nullable, max 100, free-text after `20260914220000_flight_direction_free_text.sql`). Captured on staff Full create and driver arrival. Staff return cards do **not** display it; driver rows do.
- **Estimated return:** `planned_check_out` (`timestamptz`). There is no separate estimated-return column.

There is **no** flight-number column, **no** KTW/schedule/ETA fetch in `src/`, and **no** mapping from direction text to airport destinations. Driver-ops v1 explicitly deferred flight APIs.

Safe v1 shape: keep list queries, URLs, envelopes, and check-out PATCH bodies unchanged; add a **read-only enrichment** (nested optional field or parallel fetch) keyed on `flight_direction` + `planned_check_out`, and render hours on `ReservationCard` (staff) and `DriverReservationRow` (driver). Empty/legacy/`departure`/`arrival` directions cannot be mapped without a lookup strategy — that is the main product/tech gap for `/10x-plan`.

Lessons priors: any new API must Zod-validate input before logic; form types must come from Zod, not parallel interfaces.

## Detailed Findings

### Return views (staff)

- Page: `src/pages/index.astro` → `DashboardContainer` → `useDashboard` → `TodayView` → `DeparturesColumn` → `ReservationCard`.
- List fetch: `src/hooks/useDashboard.ts` `POST /api/reservations/departures`, parsed as a JSON array (no envelope).
- API: `src/pages/api/reservations/departures.ts:6-16` → `ReservationService.getTodaysDepartures()`.
- Query: `src/lib/services/reservation.service.ts` — `status = in_progress`, `planned_check_out < startOfTomorrowWarsawIso(now)`, order `planned_check_out` ASC, limit 200, `select("*")`.
- Card display (`src/components/dashboard/ReservationCard.tsx`): Warsaw-formatted `planned_check_out`, identity fields, overdue badge. **Does not render `flight_direction`.**
- Check-out from the same card: `createCheckOutCommand()` → `PATCH /api/reservations?id=eq.{id}` with `{ status: "completed", actual_check_out }`.

### Return views (driver)

- Page: `src/pages/kierowca/index.astro` → `DriverOpsApp` (tab Wyjazdy) → `useDriverOps` → `DriverReservationRow` / `DriverDepartureDialog`.
- List fetch: `GET /api/driver/departures` → `{ data, handled }` (`src/pages/api/driver/departures.ts:22-32`).
- Pending query: `DriverService.listDepartures()` — same window/status as staff, but `DRIVER_LIST_SELECT` (includes `flight_direction`, `planned_check_out`).
- Handled query: `listHandledDepartures()` — `status = completed`, `actual_check_out >= handledWindowStartIso` (Warsaw today ∪ last 12 hours).
- Row already shows `flightDirectionLabel(flight_direction)` and `isNearCheckout` (2h before `planned_check_out`) — pickup emphasis is time-based, not flight-data-based (`src/lib/driver/display.ts:9-38`).

### Operating window (Warsaw)

- `src/lib/driver/operating-window.ts`: `startOfTomorrowWarsawIso` is the exclusive upper bound for pending lists; `handledWindowStartIso` for handled.
- Overdue UI is client-side (`isOverdue`) and must stay independent of KTW hours.
- List membership must **not** start filtering on flight hours (FR-003).

### Flight direction and planned return

| Concept in PRD | Actual column | Notes |
|---|---|---|
| Kierunek lotu | `flight_direction` | Free-text; legacy `departure`/`arrival` still in seed and old rows; empty = `null` or omitted |
| Estymowany powrót | `planned_check_out` | Parking checkout time, not flight arrival |
| Numer lotu | — | Not in DB; placeholder `"np. Londyn, LO 392"` may bury a number inside direction text |

Write paths for direction:

- Staff Full form: `FullReservationForm.tsx` → `POST /api/reservations`.
- Staff Quick create: **does not** set direction.
- Driver arrival: `DriverArrivalDialog.tsx` → `PATCH /api/driver/reservations/{id}/arrival`.
- Staff PATCH API accepts `flight_direction` but there is no edit UI.

Timezone on `planned_check_out` writes is inconsistent: staff “Zmień datę powrotu” uses Europe/Warsaw (`fromWarsawDateTimeLocal`); create and driver datetime-local use browser local `toISOString()`. The ±3h window should normalize to Warsaw at read time.

### Check-out contract (must not change)

Staff: `PATCH /api/reservations?id=eq.{uuid}` body `{ status: "completed", actual_check_out }` (`src/lib/reservations/operations.ts:10-14`). No payment fields.

Driver: `PATCH /api/driver/reservations/{uuid}/departure` — optional `notes`, `paid_at_departure`, `surcharge_amount`, `planned_check_out`; service requires `in_progress` else 409; sets `status: completed` and `actual_check_out` (`src/lib/services/driver.service.ts` `completeDeparture`).

Hooks parse list JSON without Zod field lists — **extra optional keys on list rows are safe**. Changing URLs, methods, required body fields, or `{ data, handled }` / bare-array envelopes is not.

No e2e covers check-out. Unit coverage: `operations.test.ts`, driver 409 guard, departures query contract.

### Existing flight / KTW integration

Zero matches in `src/` for KTW, Pyrzowice, IATA, aviation, ETA, scheduled arrivals. Nothing to extend; v1 must introduce a schedule source and a direction→destination matcher.

## Code References

- `src/pages/api/reservations/departures.ts:6-16` — staff return list API (bare array)
- `src/pages/api/driver/departures.ts:22-32` — driver return list API (`data` + `handled`)
- `src/lib/services/reservation.service.ts` — `getTodaysDepartures()`
- `src/lib/services/driver.service.ts:22-23` — `DRIVER_LIST_SELECT` (must add columns here if driver lists should show them)
- `src/lib/services/driver.service.ts` — `listDepartures`, `completeDeparture`
- `src/lib/driver/operating-window.ts` — Warsaw list bounds
- `src/lib/driver/display.ts:34-38` — `flightDirectionLabel`
- `src/components/dashboard/ReservationCard.tsx` — staff return card (no direction today)
- `src/components/driver/DriverReservationRow.tsx` — driver return row (shows direction)
- `src/hooks/useDashboard.ts` — staff fetch + check-out
- `src/hooks/useDriverOps.ts` — driver fetch + complete departure
- `src/lib/reservations/operations.ts:10-14` — staff check-out command
- `src/lib/schemas/reservation.schema.ts` — `flight_direction` max 100
- `src/lib/schemas/driver.schema.ts` — arrival/departure update Zod
- `src/db/database.types.ts` — reservation row (no flight number)
- `supabase/migrations/20260914220000_flight_direction_free_text.sql` — enum dropped
- `src/pages/api/AGENTS.md` — Zod-before-logic; drivers stay on `/api/driver/*`

## Architecture Insights

- Same reservation rows for staff and driver; driver SELECT is a subset. Enrichment for driver lists must extend `DRIVER_LIST_SELECT` or be joined in the UI from a separate call.
- Additive optional fields on existing list endpoints keep FR-003; a new endpoint is also compatible if the current list endpoints stay byte-compatible.
- Mapping risk is **data quality**, not missing timestamps: free-text direction vs a structured KTW destination list. v1 can skip rows with empty/legacy enum direction rather than migrate (PRD: existing reservations with direction get hours without a data migration).
- `isNearCheckout` (2h) is independent of the PRD ±3h flight window; do not reuse it as the schedule matcher.
- Any new schedule API route must Zod-validate query/body first (`lessons.md`).

## Historical Context (from prior changes)

- `context/changes/driver-operations/plan.md` — automated flight delay APIs out of driver v1; direction recorded at arrival.
- `context/changes/driver-operations/research.md` — `flight_direction` existed as enum; airport pickup as filter vs new status left open.
- `context/foundation/prd-v2.md` — flight-status integration deferred; direction recorded at arrival.
- `context/changes/hourly-parking-calendar/research.md` — calendar uses planned check-in/out, not flights; check-out reuses existing PATCH.
- `context/foundation/prd-v4.md` / `shape-notes.md` — this change: scheduled hours must-have; live ETA nice-to-have; do not pick one flight; KTW only.

## Related Research

- `context/changes/driver-operations/research.md`
- `context/changes/hourly-parking-calendar/research.md`

## Open Questions

1. **How does free-text `flight_direction` map to a KTW destination?** No IATA codes, mixed city names, optional buried flight numbers, plus legacy `departure`/`arrival`. Plan needs a matching rule (normalize/alias list vs skip unmatched).
2. **Where do scheduled KTW hours come from?** Not in the repo. Product left the source open (stack-assess / plan). v1 is scheduled hours, not live ETA.
3. **Rows with null direction** — skip hours (likely) vs prompt to fill direction (out of v1 preserve-direction scope).
4. **Should staff return cards start showing `flight_direction` as well as hours?** Driver already shows direction; staff does not.
5. **Normalize `planned_check_out` to Europe/Warsaw before the ±3h window?** Write paths disagree on timezone.
6. **Enrich list DTO vs parallel fetch?** Extra optional fields are safe for current hooks; driver still needs `DRIVER_LIST_SELECT` if the field is on the row.
