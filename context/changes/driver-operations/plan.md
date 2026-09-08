# Driver Operations — Implementation Plan

## Overview

Add a mobile-first driver module to ParkTrack so airport parking drivers can run arrivals, departures, field payments, and lot occupancy without the staff admin chrome — sharing the same reservation records as staff.

## Current State Analysis

Staff dashboard (`/`) lists arrivals/departures via `get_todays_*` RPCs that pick the **nearest calendar day ≥ today**. Same-day late arrivals stay visible; prior-day unconfirmed arrivals disappear. Check-in/out is a thin `PATCH` from `useDashboard`. Auth is a single authenticated role; `locals.user.role` is typed but unused. Reservation rows have `flight_direction`, `notes`, and coarse `is_paid`, but lack passenger count, parking sector, and arrival/departure payment timing. RLS on reservations is `authenticated` + `true`. Occupancy is already modeled as count of `status = 'in_progress'`. Cancel exists on reservation details only — dashboard cancel is out of this change.

### Key Discoveries

- Nearest-day RPCs are the wrong list shape for drivers — need overdue + calendar-today queries (`supabase/migrations/20260828120000_update_arrivals_departures_to_nearest.sql`).
- Prefer invoices-style thin route + Zod + service over `settings.ts` (`src/pages/api/invoices.ts`).
- Put role in **`app_metadata`** (not `user_metadata`); seed/docs must set it for driver users.
- Lessons: Zod at every API boundary; form VMs from `z.infer` (`context/foundation/lessons.md`).

## Desired End State

A logged-in user with `app_metadata.role = 'driver'` lands on a mobile driver home (not staff `/`), sees arrivals/departures for **all overdue confirmed (any past day) plus calendar today**, can confirm arrival with duration / flight direction / passengers / sector / paid-at-arrival, can complete departure with notes / paid-at-departure / dopłata amount, and can view cars currently on the lot (`in_progress`). Staff flows, invoices, and dashboard cancel remain unchanged. Role gates block drivers from staff routes and APIs.

**Verify:** driver login → driver UI only; overdue yesterday still listed; arrival PATCH persists new fields; staff login unchanged; `npm run test` + `typecheck` + `lint` green.

## What We're NOT Doing

- Shift management / shift-scoped lists
- Staff dashboard cancel button (separate change)
- New reservation status for airport pickup (`airport_pickup`)
- Using `payments` table for payment history (v1 stores flags + surcharge on reservation)
- Driver creating ad-hoc reservations
- Automated flight delay APIs / auto `no_show`
- Configurable sector enum / settings UI for sectors
- Offline-first
- Native mobile apps
- Astro major upgrades / npm audit remediation (tracked in health-check)

## Implementation Approach

1. Migrate schema + document role conventions.
2. Resolve role in middleware; gate routes/APIs; driver layout without staff nav.
3. New list/occupancy APIs with operating-window rules; extend update schema for driver fields.
4. Build mobile driver UI reusing domain PATCH patterns, not staff dashboard chrome.
5. Tighten RLS by JWT `app_metadata.role` and add automated tests.

**Locked decisions (planning):**

| Topic | Choice |
| ----- | ------ |
| List window | Overdue while still `confirmed`/`in_progress` (any past day) + full calendar today |
| Stale overdue | Remain until staff cancels / no_shows / check-in completes |
| Payments | Columns on reservation: arrival/departure paid flags + surcharge amount |
| Airport pickup | UI emphasis on `in_progress` near checkout — no new status |
| Sector | Free-text |
| Role source | `app_metadata.role` (`staff` \| `driver`) |

## Phase 1: Schema, role plumbing, conventions

### Overview

Add driver-facing reservation columns, wire `app_metadata.role` into `locals.user`, and document conventions so later phases share one contract.

### Changes Required

#### 1. Migration — reservation driver fields

**File**: `supabase/migrations/YYYYMMDDHHMMSS_add_driver_operation_fields.sql`

**Intent**: Persist passenger count, free-text sector, paid-at-arrival, paid-at-departure, and dopłata amount on the shared reservation row.

**Contract**: Add nullable/defaulted columns compatible with existing rows, e.g. `passenger_count int`, `parking_sector text`, `paid_at_arrival boolean default false`, `paid_at_departure boolean default false`, `surcharge_amount numeric` (nullable). Keep existing `is_paid` for now (may be derived or updated by services when either paid flag is set — document chosen sync rule in service Intent in Phase 2). Regenerate or update `src/db/database.types.ts` to match.

#### 2. Auth role on locals

**File**: `src/middleware/supabase.ts`, `src/env.d.ts`, `src/types.ts` (`AuthUserDTO`)

**Intent**: Expose `role` from Supabase user `app_metadata.role`, defaulting existing users to `staff` when missing so current accounts keep full access.

**Contract**: `locals.user = { id, email, role: 'staff' | 'driver' }`. Do not trust `user_metadata` for authorization.

#### 3. Agent conventions

**File**: `AGENTS.md` (and optionally nested driver note under `src/pages/` if a driver API folder is introduced in Phase 2)

**Intent**: Paste the driver-module conventions from `stack-assessment-v2.md` so agents do not put driver UI in staff chrome or invent shift scope.

**Contract**: Document roles, shared reservation source of truth, writable driver fields, and out-of-scope shift module.

### Success Criteria

#### Automated Verification

- Migration SQL is valid and applies in local Supabase workflow used by the project
- `npm run typecheck` passes after types update
- Existing `npm run test` suite still passes

#### Manual Verification

- Confirm a test user can be assigned `app_metadata.role = 'driver'` via Supabase dashboard/SQL and `locals.user.role` reflects it after login (log or temporary debug acceptable)

**Implementation Note**: After automated verification passes, pause for human confirmation of Manual Verification before Phase 2.

---

## Phase 2: Driver APIs + route guards

### Overview

Ship operating-window list and occupancy endpoints, extend reservation update validation for driver fields, and block drivers from staff APIs/pages (and staff-only redirects away from driver home as needed).

### Changes Required

#### 1. Operating-window list queries

**File**: new migration RPC(s) and/or service methods under `src/lib/services/`; thin routes under `src/pages/api/` (e.g. driver arrivals/departures)

**Intent**: Replace nearest-day semantics for the driver module with: arrivals = `status = 'confirmed'` and `date(planned_check_in) <= current_date`; departures = `status = 'in_progress'` and `date(planned_check_out) <= current_date`; order by planned time ascending. Do not modify staff `get_todays_*` behavior.

**Contract**: Zod-validated GET/POST handlers; return DTOs sufficient for mobile cards (id, names, plate, planned times, flight_direction, passenger_count, parking_sector, payment flags, notes as needed). Follow invoices thin-handler pattern. Role: `driver` or `staff` may call (staff optional for debugging — if staff excluded, document).

#### 2. Occupancy list

**File**: driver occupancy API + service

**Intent**: List vehicles currently on the lot for drivers.

**Contract**: Rows with `status = 'in_progress'` (same definition as stats occupancy count). Include plate, names, sector, planned checkout at minimum.

#### 3. Extend update schema for driver check-in/out

**File**: `src/lib/schemas/reservation.schema.ts`, `src/lib/services/reservation.service.ts`, `src/pages/api/reservations.ts` (or dedicated driver action routes)

**Intent**: Allow drivers to persist arrival/departure field updates through validated updates — not unvalidated PATCH.

**Contract**: Extend `updateReservationSchema` (or add `driverArrivalUpdateSchema` / `driverDepartureUpdateSchema`) with new columns; derive types via `z.infer`. Arrival update may set `status: in_progress`, `actual_check_in`, duration (`planned_check_out` adjust), `flight_direction`, `passenger_count`, `parking_sector`, `paid_at_arrival`. Departure update may set `status: completed`, `actual_check_out`, `notes`, `paid_at_departure`, `surcharge_amount`. Enforce status preconditions in service (confirmed→in_progress; in_progress→completed). Sync `is_paid` if either paid flag is true (choose one clear rule and test it).

#### 4. Middleware / API role guards

**File**: `src/middleware/auth.ts`, driver vs staff page routes, login redirect (`login-form.tsx`)

**Intent**: Drivers cannot open staff surfaces; after login drivers land on driver home.

**Contract**: Deny `driver` on staff prefixes (`/ustawienia`, `/faktury`, `/rezerwacje` admin list if out of driver scope, `/api/stats`, `/api/invoices`, `/api/settings`, …). Allow driver routes + reservation update/list APIs needed for ops. Authenticated `staff` keep current behavior. Redirect `driver` from `/` and `/login` to driver home path (e.g. `/kierowca` or `/driver` — pick one kebab Polish/English consistent with existing `/rezerwacje` Polish routes: prefer `/kierowca`).

### Success Criteria

#### Automated Verification

- Unit/integration tests for list window rules (overdue yesterday included; tomorrow excluded; same-day included)
- Schema tests for new update fields (lessons: Zod boundary)
- Auth middleware tests: driver 401/302 on staff API/page; staff still allowed
- `npm run test`, `npm run typecheck`, `npm run lint` pass

#### Manual Verification

- Call list API as driver with seeded overdue + today + tomorrow rows; confirm filter
- Confirm staff `get_todays_*` dashboard unchanged

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Mobile driver UI

### Overview

Ship the driver-facing mobile surface: home lists, arrival card, departure/pickup card, occupancy view — no staff navigation.

### Changes Required

#### 1. Driver layout and navigation

**File**: new layout (e.g. `src/layouts/DriverLayout.astro`), page(s) under `src/pages/kierowca/`, minimal driver nav

**Intent**: Full-bleed mobile ops chrome without Dashboard/Rezerwacje/Ustawienia staff links.

**Contract**: Large tap targets; no horizontal pan for core flows; logout via existing auth logout API.

#### 2. Arrivals / departures lists

**File**: React islands under `src/components/driver/` + hooks fetching Phase 2 APIs

**Intent**: Show operating-window lists; open a card for actions. Visually emphasize overdue and near-checkout pickup candidates without a new status.

**Contract**: Poll or refresh comparable to dashboard (~60s) acceptable. Cards show surname, plate, passenger count, flight direction as available.

#### 3. Arrival confirm card

**File**: driver arrival form component

**Intent**: One mobile card to confirm arrival and edit PRD fields.

**Contract**: Form VM from Zod schema (`z.infer`). On submit → Phase 2 update API. Success updates list state.

#### 4. Departure / payment card

**File**: driver departure form component

**Intent**: Complete departure with notes, paid-at-departure, optional dopłata when stay extended.

**Contract**: Allow editing actual return implications via `surcharge_amount` (and planned/actual checkout fields as needed). No invoice generation UI.

#### 5. Occupancy view

**File**: driver occupancy list UI

**Intent**: Show cars currently on the lot.

**Contract**: Bound to occupancy API; readable on phone/tablet.

### Success Criteria

#### Automated Verification

- Component/hook tests where patterns already exist; at least schema + hook happy paths if lightweight
- `npm run typecheck`, `npm run lint`, `npm run test` pass

#### Manual Verification

- Phone/tablet viewport: login as driver → lists → confirm arrival → fields persist → visible to staff on dashboard/details
- Departure with dopłata persists; staff invoice/stats still load for staff user
- Driver cannot navigate to `/ustawienia` or `/faktury`

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: RLS hardening + automated regression

### Overview

Defense-in-depth RLS by role claim, plus regression coverage so driver gates and list rules do not silently regress.

### Changes Required

#### 1. RLS policies

**File**: new migration adjusting `reservations` (and related tables as needed) policies

**Intent**: Stop open `authenticated` + `true` from giving drivers write access beyond operational updates; keep staff full access.

**Contract**: Policies keyed off `auth.jwt() -> 'app_metadata' ->> 'role'`. Drivers: SELECT operational rows; UPDATE limited to allowed columns/statuses (or rely on service role carefully — prefer authenticated client with narrow UPDATE). Staff: preserve current full access. Do not break external API path that uses service/admin patterns if any.

#### 2. Tests and e2e smoke

**File**: colocated API tests; extend `src/middleware/auth.test.ts`; optional Playwright smoke under `e2e/`

**Intent**: Lock list window, role redirects, and denial of staff APIs for drivers.

**Contract**: Follow existing Vitest + Playwright locator rules (`getByRole` etc. if e2e added). No `waitForTimeout`.

### Success Criteria

#### Automated Verification

- `npm run test` includes new cases for window + auth
- Optional: `npm run test:e2e` smoke for driver login redirect (if credentials available in env)
- `npm run typecheck`, `npm run lint` pass

#### Manual Verification

- Driver JWT cannot update unrelated fields or access invoice APIs even if UI is bypassed (API-level check)
- Staff regression: create reservation, dashboard check-in, open invoice flow still works

**Implementation Note**: After Phase 4, mark change ready for `/10x-impl-review` / archive path as appropriate.

---

## Testing Strategy

### Unit Tests

- Operating-window filter helpers / RPC contract fixtures (yesterday overdue in; tomorrow out)
- Zod driver arrival/departure schemas (optional fields, surcharge)
- Auth middleware role matrix (driver vs staff vs anonymous)

### Integration Tests

- PATCH arrival/departure updates persist new columns
- List endpoints return expected IDs for seeded dataset

### Manual Testing Steps

1. Seed: overdue confirmed (yesterday), today confirmed, tomorrow confirmed, one `in_progress`
2. Login driver → only overdue+today on arrivals; tomorrow absent
3. Confirm arrival with sector/passengers/paid-at-arrival → staff sees `in_progress`
4. Complete departure with surcharge → staff sees completed + amounts
5. Login staff → dashboard nearest-day behavior unchanged; invoices still work
6. Resize to mobile width — primary actions usable without zoom

## Performance Considerations

List endpoints should stay cheap (indexed filters on `status` + planned timestamps). Polling ~60s is fine for small lots. Avoid loading full staff reservation admin datasets into driver UI.

## Migration Notes

- Existing reservations: new columns default safely (`false` / null).
- Existing users without `app_metadata.role`: treat as `staff`.
- Create at least one driver user in each environment by setting `app_metadata.role = 'driver'`.
- Rollback: revert UI/routes first; column drops only if needed (nullable columns can remain).

## References

- Related research: `context/changes/driver-operations/research.md`
- PRD: `context/foundation/prd-v2.md`
- Stack assessment: `context/foundation/stack-assessment-v2.md`
- Lessons: `context/foundation/lessons.md`
- Staff list RPC: `supabase/migrations/20260828120000_update_arrivals_departures_to_nearest.sql`
- Auth middleware: `src/middleware/auth.ts`
- Dashboard check-in pattern: `src/hooks/useDashboard.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema, role plumbing, conventions

#### Automated

- [x] 1.1 Migration applies and database types updated
- [x] 1.2 Typecheck passes after role + schema wiring
- [x] 1.3 Existing test suite still passes

#### Manual

- [x] 1.4 Driver role in app_metadata reflected on locals after login

### Phase 2: Driver APIs + route guards

#### Automated

- [ ] 2.1 List window unit/integration tests (overdue + today; exclude tomorrow)
- [ ] 2.2 Schema tests for driver update fields
- [ ] 2.3 Auth middleware tests for driver vs staff
- [ ] 2.4 test + typecheck + lint pass

#### Manual

- [ ] 2.5 Seeded list API verified as driver
- [ ] 2.6 Staff get_todays_* dashboard unchanged

### Phase 3: Mobile driver UI

#### Automated

- [ ] 3.1 test + typecheck + lint pass with driver UI added

#### Manual

- [ ] 3.2 Full arrival → departure cycle on mobile viewport as driver
- [ ] 3.3 Staff still sees updates; driver blocked from staff pages

### Phase 4: RLS hardening + automated regression

#### Automated

- [ ] 4.1 New auth/list regression tests green
- [ ] 4.2 test + typecheck + lint pass

#### Manual

- [ ] 4.3 API-level driver denial / staff regression smoke
