# Arrivals Timeline Connect Implementation Plan

## Overview

Show scheduled KTW arrival hours on existing staff and driver return (departure) lists. Bind by saved `flight_direction` plus `planned_check_out` in a ± about 3h window (Europe/Warsaw). If several board rows match, show all those hours. Do not change list membership, envelopes, or check-out.

## Current State Analysis

Return lists are departures: `in_progress` and `planned_check_out` before Warsaw tomorrow. Staff: `POST /api/reservations/departures` → bare array. Driver: `GET /api/driver/departures` → `{ data, handled }`. Check-out is unchanged staff `PATCH /api/reservations?id=eq.{id}` with `{ status, actual_check_out }` and driver `PATCH /api/driver/reservations/{id}/departure`.

`flight_direction` is free-text (nullable, max 100); legacy `departure`/`arrival` remain. `planned_check_out` is parking checkout, not landing time. There is no flight-number column and no flight fetch in `src/`. Staff `ReservationCard` does not show direction; driver `DriverReservationRow` does. Hooks parse list JSON without field schemas — extra optional keys are safe. Lessons: Zod-validate any new request input; do not duplicate form interfaces.

Official public board: [tablica lotów KTW](https://www.katowice-airport.com/pl/dla-pasazera/tablica-lotow-online). No documented JSON API. Live fetch belongs behind a port; CI uses fixtures.

## Desired End State

Staff on `/` and driver on `/kierowca` (Wyjazdy) see, for rows with a matchable direction, one or more Warsaw clock times from the KTW arrivals board whose origin matches the alias and whose scheduled time is within ± about 3h of `planned_check_out`. Rows with empty/legacy/unmatched direction look as today plus no hours. Check-out and list filters behave as today. Schedule fetch failure omits hours; the list still returns 200.

### Key Discoveries:

- List contracts to preserve: `src/pages/api/reservations/departures.ts`, `src/pages/api/driver/departures.ts` (envelopes and query windows).
- Check-out to preserve: `src/lib/reservations/operations.ts:10-14`, `DriverService.completeDeparture`.
- Attach hours in memory after the existing select — do not put `ktw_arrival_hours` in Postgres or `DRIVER_LIST_SELECT`.
- `isNearCheckout` (2h) is pickup emphasis, not the ±3h matcher.
- Normalize `planned_check_out` to Europe/Warsaw before the window (write paths disagree on TZ).

## What We're NOT Doing

- Live status / ETA on the card (FR-007 nice-to-have).
- Storing or requiring a flight number (FR-006).
- Picking a single flight when several match.
- Changing check-out URLs, methods, bodies, or `in_progress → completed`.
- Changing list envelopes, operating-window filters, or auth/roles.
- Other airports than KTW.
- Prompting staff/driver to fill missing direction on the return list.
- Treating legacy `departure`/`arrival` as “all KTW destinations”.
- Database migration or backfill.
- Client-side calls to the airport (no keys/CORS on the tablet).
- Hitting the live board from unit/CI tests.

## Implementation Approach

Pure matcher + window first (no network). Then a `KtwArrivalsPort` whose live adapter fetches the official KTW public arrivals board (URL via env, timeout, one fetch per list request). Enrich existing departure list responses with optional `ktw_arrival_hours`. Fail-soft: adapter/matcher errors → hours omitted, reservations unchanged. UI reads the optional field only on departure cards/rows.

## Critical Implementation Details

**Timing:** Fetch the board once per list request, then match every row in memory. Do not fetch per reservation. If the adapter throws or times out, still return the reservation list.

**User experience:** Hours are a read-only list of clock times (and origin label if useful). Multiple matches stay multiple. Empty hours: render nothing extra — do not show an error chip that looks like a failed list.

**Performance:** Board fetch must not block check-out. Timeout the adapter (low seconds). List query stays as today; enrichment is after the DB round-trip.

## Phase 1: Matcher and ±3h window

### Overview

Pure functions: normalize `flight_direction` through an alias table; compute whether a scheduled instant falls in ± about 3h of `planned_check_out` in Europe/Warsaw; collect all matching board rows. No HTTP, no API, no UI.

### Changes Required:

#### 1. Alias table and matcher

**File**: `src/lib/ktw/direction-match.ts` (and colocated `direction-match.test.ts`)

**Intent**: Map free-text direction to a destination key used on the KTW board (city/origin label). Skip null, blank, `departure`, and `arrival`.

**Contract**: Case-insensitive; alias list in-repo (common origins + substrings e.g. “londyn” → the board’s origin spelling). `contains` against aliases, not exact whole-string only. Unmatched → no key. Do not parse flight numbers.

#### 2. Arrival window

**File**: `src/lib/ktw/arrival-window.ts` (and `arrival-window.test.ts`)

**Intent**: Decide which scheduled arrivals belong with a planned return.

**Contract**: Convert `planned_check_out` to Europe/Warsaw; include a scheduled time if the absolute difference is about 3 hours or less (inclusive window of 3h either side). Independent of `isNearCheckout`.

#### 3. Hours selector

**File**: `src/lib/ktw/select-arrival-hours.ts` (and test)

**Intent**: Given board rows + one reservation’s direction and planned return, return all matching hours (not one).

**Contract**: Input board rows `{ originLabel, scheduledAt }`; output ordered list of ISO instants (and origin label). Empty list when no match.

### Success Criteria:

#### Automated Verification:

- Unit tests cover: alias hit, substring with extra text (`Londyn, LO 392`), skip null/legacy enum, unmatched skip, window inside/outside ±3h, multiple hours kept, Warsaw TZ around DST if a fixture exists.
- `npm run test -- src/lib/ktw`
- `npm run typecheck`

#### Manual Verification:

- None (no UI yet).

---

## Phase 2: KTW board adapter and list enrichment

### Overview

Live-read the public KTW arrivals board behind a port. Attach optional `ktw_arrival_hours` on existing staff and driver departure list payloads. Lists and check-out routes stay the same. Failure omits hours.

### Changes Required:

#### 1. Port and live adapter

**File**: `src/lib/ktw/ktw-arrivals.port.ts`, `src/lib/ktw/katowice-board.adapter.ts`, fixture tests under `src/lib/ktw/`

**Intent**: Production loads current KTW arrivals from the official public flight board; tests never call the network.

**Contract**: `listArrivals(now: Date): Promise<{ originLabel: string; scheduledAt: string }[]>`. Env `KTW_ARRIVALS_URL` defaulting to the official PL board URL. Timeout; on failure throw a typed error for the enricher to swallow. Parse origin + scheduled time from the board payload the implementer pins against a saved fixture (HTML or JSON — whichever the live page actually serves). Do not call paid flight-status vendors.

#### 2. Enricher

**File**: `src/lib/services/ktw-arrival-hours.service.ts` (and test with a fake port)

**Intent**: One board fetch, then attach hours per row using Phase 1 functions.

**Contract**: `enrichDepartures(rows): Promise<DepartureListItem[]>`. `DepartureListItem` = reservation row plus optional `ktw_arrival_hours: { scheduled_at: string; origin_label: string }[]`. Catch adapter errors → return rows with the field omitted. Do not drop or reorder rows. Do not filter by hours.

#### 3. Staff list

**File**: `src/lib/services/reservation.service.ts` — `getTodaysDepartures` only

**Intent**: After the existing query, run the enricher. Query predicates unchanged.

**Contract**: Response remains a JSON array. Each element may include `ktw_arrival_hours`. `POST /api/reservations/departures` method, URL, and 200-on-success unchanged. Check-out PATCH untouched.

#### 4. Driver list

**File**: `src/lib/services/driver.service.ts` — `listDepartures` and `listHandledDepartures`

**Intent**: Same enrichment on pending and handled departure arrays.

**Contract**: `GET /api/driver/departures` still `{ data, handled }`. `DRIVER_LIST_SELECT` unchanged (hours are not a DB column). Arrival list endpoints unchanged. `completeDeparture` untouched.

#### 5. Types

**File**: `src/types.ts`

**Intent**: List item type for the extra field; do not pretend it is a Postgres column on `ReservationDto`.

**Contract**: `ktw_arrival_hours` optional on the list item type used by cards/hooks. `ReservationDto` stays `Tables<"reservations">`.

#### 6. Instruction note

**File**: `src/pages/api/AGENTS.md` and/or `AGENTS.md`

**Intent**: Agents must not “fix” a missing board by failing the departures endpoint.

**Contract**: Short rule: enrich after query; fail-soft; Zod still required if any new request input appears (none expected on these GETs/POSTs).

### Success Criteria:

#### Automated Verification:

- Enricher tests: fake port returns two origins; matching row gets both hours in window; unmatched row has empty/omitted hours; thrown port → list length unchanged, no hours.
- Adapter parse tests against a committed fixture (not live HTTP).
- Existing `reservation.service.test.ts` departures query contract still passes.
- Existing `driver.service.test.ts` list/completeDeparture tests still pass.
- `npm run test`
- `npm run typecheck`
- `npm run lint`

#### Manual Verification:

- With network: open staff Wyjazdy and driver Wyjazdy; rows with a known alias show hours; checkout still completes.
- Kill/block the board URL (or invalid `KTW_ARRIVALS_URL`): lists still load; no hours; checkout still works.

---

## Phase 3: Staff and driver UI

### Overview

Render hours on return cards. Staff also shows direction when present. Arrivals columns, occupancy, and check-out buttons stay as today.

### Changes Required:

#### 1. Staff return card

**File**: `src/components/dashboard/ReservationCard.tsx` (props type in `src/types.ts`)

**Intent**: On `actionType === "check-out"` only, show `flight_direction` (same labeling as `flightDirectionLabel`) when set, and the list of KTW hours when `ktw_arrival_hours` is non-empty.

**Contract**: Check-out / cancel / change-return-date handlers and disabled rules unchanged. Arrival cards (`check-in`) do not show KTW hours. Times formatted in Europe/Warsaw (reuse staff card timezone, not `isNearCheckout`).

#### 2. Driver return row

**File**: `src/components/driver/DriverReservationRow.tsx`

**Intent**: On `mode === "departure"`, show KTW hours next to the existing direction line.

**Contract**: Arrival and occupancy modes unchanged. `isNearCheckout` / overdue badges unchanged. Wydanie still opens `DriverDepartureDialog` with the same payload.

#### 3. Hooks

**File**: `src/hooks/useDashboard.ts`, `src/hooks/useDriverOps.ts`

**Intent**: Carry the optional field through JSON into the card/row. No extra fetch.

**Contract**: Staff still `POST /api/reservations/departures`. Driver still `GET /api/driver/departures`. Check-out fetch URLs and bodies unchanged.

### Success Criteria:

#### Automated Verification:

- If there is a cheap render test, assert check-out card shows multiple hours and hides them when the field is missing; otherwise rely on typecheck + existing unit suite.
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- Existing unauthenticated e2e still pass: `npm run test:e2e` (auth guards only; no new checkout e2e required)

#### Manual Verification:

- Staff `/`: departure card with alias direction shows direction + all candidate hours; empty direction looks like today; Check-out still completes.
- Driver `/kierowca` Wyjazdy: hours on pending (and handled if enriched); Wydanie dialog/payment flow unchanged.
- Several board rows in window → several hours, no single pick.
- Board down → lists usable, no hours.

---

## Testing Strategy

### Unit Tests:

- Matcher: aliases, substrings, skip null/legacy/unmatched.
- Window: inside/outside ±3h, Warsaw conversion.
- Selector: multiple hours preserved, order stable (by scheduled time).
- Enricher: fake port success/failure; row count invariant.

### Integration Tests:

- Parse fixture of the public board shape (no network).
- Departures service tests keep query predicates; enrichment is additive.

### Manual Testing Steps:

1. Reservation with `flight_direction` like `Londyn` (or another seeded alias) and `planned_check_out` near a real KTW arrival — both UIs show those hours.
2. Reservation with empty direction — no hours, still on the list, check-out works.
3. Reservation with `departure`/`arrival` — no hours.
4. Disconnect board — lists load, check-out works.
5. Two arrivals from the same origin in the window — both hours visible.

## Performance Considerations

One outbound request per departures list load, with a short timeout. Matching is in-memory over ≤200 rows. Do not add per-row HTTP. Do not wait on the board from check-out PATCH.

## Migration Notes

No schema migration. Existing rows with a matchable free-text direction get hours without backfill. Unmatchable rows stay valid reservations.

## References

- Related research: `context/changes/arrivals-timeline-connect/research.md`
- PRD: `context/foundation/prd-v4.md`
- Lessons: `context/foundation/lessons.md`
- Board: `https://www.katowice-airport.com/pl/dla-pasazera/tablica-lotow-online`
- Staff list: `src/pages/api/reservations/departures.ts`
- Driver list: `src/pages/api/driver/departures.ts`
- Check-out command: `src/lib/reservations/operations.ts:10-14`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Matcher and ±3h window

#### Automated

- [x] 1.1 Unit tests for alias, substring, skip null/legacy/unmatched, ±3h window, multiple hours — d347cba
- [x] 1.2 `npm run test -- src/lib/ktw` — d347cba
- [x] 1.3 `npm run typecheck` — d347cba

### Phase 2: KTW board adapter and list enrichment

#### Automated

- [x] 2.1 Enricher tests with fake port (match, skip, fail-soft)
- [x] 2.2 Adapter parse tests against committed fixture (no live HTTP)
- [x] 2.3 Existing reservation/driver service tests still pass
- [x] 2.4 `npm run test`
- [x] 2.5 `npm run typecheck`
- [x] 2.6 `npm run lint`

#### Manual

- [x] 2.7 Staff and driver Wyjazdy show hours when the board is reachable
- [x] 2.8 Invalid/blocked board URL: lists load, checkout works, hours omitted

### Phase 3: Staff and driver UI

#### Automated

- [ ] 3.1 `npm run typecheck`
- [ ] 3.2 `npm run lint`
- [ ] 3.3 `npm run test`
- [ ] 3.4 Existing e2e auth guards pass (`npm run test:e2e`)

#### Manual

- [ ] 3.5 Staff departure card: direction + candidate hours; empty direction unchanged; checkout works
- [ ] 3.6 Driver Wyjazdy: hours beside direction; Wydanie unchanged
- [ ] 3.7 Multiple hours in window all shown
- [ ] 3.8 Board down: lists usable without hours
