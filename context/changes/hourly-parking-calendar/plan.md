# Staff parking calendar Implementation Plan

## Overview

Add a staff-only calendar at `/kalendarz` so the parking manager can browse arrivals and departures across **day, week, and month**, toggle layers, assign **timed driver shifts** (overlaps allowed), and **run reservation operations** after clicking an event. Month cells show **arrival count, departure count, and expected occupancy** (stays overlapping that Warsaw day). This is a new window — not the dashboard nearest-day lists and not the driver operating window.

## Current State Analysis

Dashboard `/` is two flat lists via `get_todays_arrivals` / `get_todays_departures` (nearest calendar day, PostgreSQL `current_date`, not Warsaw). Driver `/kierowca` lists overdue + Warsaw today only. There is no event calendar, no `shift` table, and no in-app directory of drivers (`app_metadata.role` on Auth only). `GET /api/reservations?date_from&date_to` filters stay overlap, not arrival/departure event streams. Staff detail UI lives at `/rezerwacje/[id]` (`ReservationDetailsView`); dashboard check-in/out is a working PATCH in `useDashboard`; detail-page check-in/out modals are still placeholders. Lessons: Zod at every API boundary; form types from `z.infer`.

## Desired End State

Staff opens `/kalendarz` on **Europe/Warsaw today**, switches day/week/month, steps prev/next, and toggles **arrivals, departures, shifts** (all on by default). Timed views place events at **planned** `planned_check_in` / `planned_check_out` for statuses **confirmed** and **in_progress**. Arrivals and departures use **distinct colors**; shifts a **third** style. Month cells show three numbers: arrivals that day, departures that day, occupancy = stays whose planned window overlaps that Warsaw day with those statuses. Clicking a reservation opens **details dialog** with real check-in/out (same mutations as existing services). Staff can **create/edit/delete timed shifts** and pick the driver from **Auth users with `role=driver`**. Drivers cannot open the calendar or its APIs. `/kierowca` lists stay unscoped by shift.

### Key Discoveries:

- Reuse Warsaw bounds from `src/pages/api/stats.ts` (`getWarsawPeriodBounds`), not dashboard RPCs — `src/hooks/useDashboard.ts` and `supabase/migrations/20260828120000_update_arrivals_departures_to_nearest.sql`.
- Staff-only prefixes in `src/middleware/auth.ts` must include `/kalendarz` and the new API prefix; e2e pattern: `e2e/driver-role.unauthenticated.spec.ts`.
- Driver picker needs `createSupabaseAdminClient()` + `auth.admin.listUsers` — `src/lib/supabase-admin.ts`. No `profiles` table.
- Click path: `ReservationDetailsView` + `useReservationDetails` (`src/components/reservations/details/ReservationDetailsView.tsx`, `src/hooks/useReservationDetails.ts`). Wire `performCheckIn` / `performCheckOut` to the placeholders (or extract shared PATCH used by dashboard).
- Occupancy-per-day is **not** live `in_progress` snapshot (`stats.ts`); it is **planned-window overlap** on that Warsaw day.

## What We're NOT Doing

- Changing driver list window or shift-scoping `/kierowca` / `/api/driver/*`.
- Replacing dashboard `/` two-column Today view.
- Showing cancelled / no_show / completed as calendar events (unless they remain confirmed/in_progress).
- Painting **actual** check-in/out as extra markers (planned times only).
- Hour grid in month view.
- FullCalendar / third-party scheduler dependency unless the implementer finds a fit that does not fight Astro/React islands — default is first-party UI consistent with shadcn.
- User-admin UI beyond listing drivers for the shift picker (no role editor).
- Visual occupancy heatmap / `daily_occupancy` backfill.
- Migrating historical shift data (none exists).

## Implementation Approach

New staff surface + two new API families: **calendar events** (read reservations as typed events + month aggregates) and **shifts** (CRUD) plus **driver directory** (read-only listUsers). UI is a client island on `/kalendarz`. Mutations for reservations reuse existing PATCH paths. All timestamps interpreted in **Europe/Warsaw** for grouping, navigation, and month counts.

## Critical Implementation Details

**Timezone:** Group hours and “which day an event belongs to” with Warsaw calendar dates, same helper family as stats/driver `warsawDateKey`. Do not use `date(planned_check_in)` in the DB session TZ or browser-local `toLocaleDateString` without a timezone.

**Occupancy count:** For Warsaw day `[start, end)`: count reservations with `status IN ('confirmed','in_progress')` AND `planned_check_in < end` AND `planned_check_out > start`. Arrival count: `planned_check_in` in `[start,end)`. Departure count: `planned_check_out` in `[start,end)`. Same status filter. Day/week event chips must use the same filters so month numbers match.

**Auth:** Calendar APIs are staff-only via middleware **and** RLS (shifts: authenticated staff only; never grant drivers SELECT on all shifts). `listUsers` only behind staff middleware; never expose service role to the client.

**Overlapping shifts:** Allowed. Render all; do not unique-by-day.

## Phase 1: Persistence and staff APIs

### Overview

Shifts table + RLS, Zod schemas, services, and staff-only HTTP: list drivers, list/create/update/delete shifts, fetch calendar events and month-day aggregates for a Warsaw range.

### Changes Required:

#### 1. Migration `driver_shifts`

**File**: `supabase/migrations/` (new timestamped SQL)

**Intent**: Persist timed shift assignments so the calendar can show and edit who is on shift.

**Contract**: Table `public.driver_shifts`: `id` uuid PK, `driver_user_id` uuid not null (Auth user id, no required FK to `auth.users`), `starts_at` timestamptz not null, `ends_at` timestamptz not null, `created_at` timestamptz default now(), check `ends_at > starts_at`. RLS: staff (`current_app_role()` is not `driver`) can select/insert/update/delete; drivers no access. Overlaps not constrained in SQL.

#### 2. Generated types

**File**: `src/db/database.types.ts` (regenerate per project convention)

**Intent**: Type the new table like other public tables.

**Contract**: `driver_shifts` Row/Insert/Update present after typegen.

#### 3. Zod + DTOs

**File**: `src/lib/schemas/` (new calendar + shift schemas), `src/types.ts`

**Intent**: Validate all calendar/shift/driver-list request data at the API boundary; ViewModels from `z.infer` only.

**Contract**: Query schema for events: `from`/`to` ISO instants or Warsaw date + `view=day|week|month`. Shift write schema: `driver_user_id`, `starts_at`, `ends_at`. Event DTO: `kind: 'arrival' | 'departure'`, `at`, reservation id + display fields needed for chips. Month cell DTO: `date`, `arrivals`, `departures`, `occupancy`. Driver list DTO: `id`, `email` (and name if Auth provides). Re-export inferred types from `src/types.ts`.

#### 4. Services

**File**: `src/lib/services/` (new calendar + shift services; thin wrappers)

**Intent**: Keep HTTP handlers free of query logic; reuse Warsaw bound helpers (extract from `stats.ts` into a shared module if that avoids duplication).

**Contract**: `listEvents(from,to)` returns arrival+departure events with the status/time rules above. `listMonthCounts(from,to)` returns per-Warsaw-day triples. Shift CRUD by id. `listDrivers()` via admin Auth, filter `app_metadata.role === 'driver'`, handle pagination. 503 when admin client is null — same pattern as settings/stats.

#### 5. API routes

**File**: `src/pages/api/` (e.g. `calendar/events.ts`, `calendar/month.ts`, `shifts/index.ts`, `shifts/[id].ts`, `drivers.ts` or equivalent staff prefix)

**Intent**: Staff HTTP for the calendar. Zod parse **before** any query.

**Contract**: Methods: GET events, GET month aggregates, GET drivers, GET/POST shifts, PATCH/DELETE shift by id. JSON errors 400/401/403/404/503 consistent with existing APIs. Document in `src/pages/api/AGENTS.md`.

#### 6. Middleware

**File**: `src/middleware/auth.ts`

**Intent**: Drivers must not hit calendar pages or APIs.

**Contract**: Add `/kalendarz` to staff-only page prefixes and the chosen `/api/...` prefixes to `STAFF_ONLY_API_PREFIXES`. Extend `isStaffOnlyPath` tests in `src/middleware/auth.test.ts`.

### Success Criteria:

#### Automated Verification:

- New migration applies on a clean local DB
- Unit tests: Warsaw day bounds, occupancy overlap, event classification, shift `ends_at > starts_at`, Zod rejection of bad queries
- `npm run test`, `npm run typecheck`, `npm run lint` pass

#### Manual Verification:

- Staff can GET events for a known seed day and see arrivals/departures JSON
- Driver token receives 403 on the same URLs

**Implementation Note**: After this phase’s automated checks pass, pause for manual API confirmation before UI work.

---

## Phase 2: Calendar shell — day and week

### Overview

Staff page, nav entry, view switcher, range navigation, visibility toggles, timed day/week grid with colored arrival/departure chips and shift bars (read from APIs).

### Changes Required:

#### 1. Page and layout

**File**: `src/pages/kalendarz.astro` (new), `src/components/Navigation.tsx`

**Intent**: Dedicated staff view, not a dashboard tab.

**Contract**: Route `/kalendarz`. Nav item labeled for calendar (do not steal Rezerwacje’s meaning). Page uses staff `Layout`. Default range: Warsaw today / current week containing today.

#### 2. Calendar island

**File**: `src/components/calendar/` (new)

**Intent**: Day and week layouts in Warsaw; prev/next/today; toggles arrivals, departures, shifts default **on**.

**Contract**: Fetch events+shifts for the visible range. Chip color by `kind`. Shifts use a third visual language. Empty range shows an explanatory empty state. Loading/error match existing staff patterns (toasts/skeletons as used on dashboard).

#### 3. Client hook

**File**: `src/hooks/` (e.g. `useParkingCalendar.ts`)

**Intent**: Own range, view mode, visibility, and refetch after mutations.

**Contract**: Does not call `get_todays_*` or `/api/driver/*`.

### Success Criteria:

#### Automated Verification:

- Component/hook tests for grouping events into Warsaw hours and applying visibility filters
- Middleware tests still pass; `npm run test`, `typecheck`, `lint` pass

#### Manual Verification:

- Staff: day and week, prev/next, toggles hide/show layers, colors distinguishable
- Driver visiting `/kalendarz` redirects to `/kierowca`
- Dashboard `/` unchanged

---

## Phase 3: Month view counts

### Overview

Month grid: each day shows arrival count, departure count, occupancy (overlap rule). Clicking a day drills to day view for that Warsaw date.

### Changes Required:

#### 1. Month UI

**File**: `src/components/calendar/` (month grid)

**Intent**: Density the manager can scan; no hour rows.

**Contract**: Three figures per cell using month aggregate API; arrival/departure numbers use the same colors as chips. Occupancy labeled so it is not confused with arrivals. Days outside the month visually muted.

### Success Criteria:

#### Automated Verification:

- Tests: a reservation spanning midnight Warsaw increments occupancy on both days; arrival count only on check-in day
- `npm run test`, `typecheck`, `lint` pass

#### Manual Verification:

- Month totals for a seed week match summing day-view events
- Drill-down from a cell opens that day

---

## Phase 4: Operations, shift assignment, e2e

### Overview

Reservation click opens details with **working** check-in/out. Empty slot / shift click assigns or edits a timed shift with driver picker. E2E: driver forbidden; staff happy path.

### Changes Required:

#### 1. Reservation operations from calendar

**File**: `ReservationDetailsView.tsx`, check-in/out placeholders, `useReservationDetails.ts`, calendar chip click handler

**Intent**: One operation surface; no third state machine.

**Contract**: Calendar opens details in a dialog (stay on `/kalendarz`). Placeholders call `performCheckIn` / `performCheckOut` (or shared helper used by `useDashboard`). After success, calendar refetches events. Dashboard one-click buttons remain.

#### 2. Shift assignment UI

**File**: `src/components/calendar/` (shift dialog)

**Intent**: Staff assigns a driver to a start–end interval and can edit/delete.

**Contract**: Driver dropdown from GET drivers. Overlapping shifts allowed (no error). Validate `ends_at > starts_at` with Zod on submit. Form types from `z.infer`.

#### 3. Docs

**File**: `AGENTS.md`

**Intent**: Shift management is no longer “out of scope v1” for staff calendar.

**Contract**: Note staff calendar + shifts; driver lists still not shift-scoped.

#### 4. E2E

**File**: `e2e/` (extend driver-role specs; optional staff calendar smoke)

**Intent**: Drivers never see calendar; staff can open it when env allows.

**Contract**: Unauthenticated/driver 403/redirect coverage for `/kalendarz` and APIs, same style as `e2e/driver-role.unauthenticated.spec.ts`.

### Success Criteria:

#### Automated Verification:

- Unit tests: shift overlap allowed; driver list filters non-drivers
- Check-in/out from details updates reservation status (unit or hook test)
- `npm run test`, `npm run typecheck`, `npm run lint` pass
- `npm run test:e2e` for the new driver-denied calendar cases when Playwright env is available

#### Manual Verification:

- Click arrival → details → check-in → chip/status updates after close
- Assign two overlapping shifts → both visible
- Driver cannot CRUD shifts
- `/kierowca` behavior unchanged

**Implementation Note**: Pause after automated verification for human UI pass on day/week/month and shift picker.

---

## Testing Strategy

### Unit Tests:

- Warsaw bounds and which day an ISO instant falls on
- Event classification (arrival vs departure) and status filter
- Occupancy overlap across midnight
- Shift Zod (`ends_at > starts_at`)
- Visibility filter combinator
- `isStaffOnlyPath('/kalendarz')`

### Integration Tests:

- API 400 on invalid range; 403 as driver
- Admin client missing → 503 on driver list

### Manual Testing Steps:

1. Staff: `/kalendarz`, today Warsaw, all layers on
2. Toggle each layer; prev/next in all three views
3. Month numbers vs day view for the same date
4. Click event → check-in/out → back to calendar
5. Create overlapping shifts for two drivers
6. Driver login: no calendar, lists unchanged
7. Dashboard lists still check-in/out

## Performance Considerations

Load events for the **visible range only** (one week or one month), not the full table. `listUsers` is small-scale (staff parking). Month occupancy is O(reservations overlapping the month) — acceptable at current `target_scale` small; if slow, constrain with `planned_check_out >= monthStart AND planned_check_in < monthEnd`.

## Migration Notes

Additive `driver_shifts` table; no backfill. Rollback = drop table + remove routes. Existing reservations unchanged. Local Auth users with `app_metadata.role=driver` appear in the picker; seed at least one driver in dev if missing.

## References

- Related research: `context/changes/hourly-parking-calendar/research.md`
- Lessons: `context/foundation/lessons.md`
- Driver vs staff: `src/middleware/auth.ts`, `context/changes/driver-operations/research.md`
- Warsaw stats: `src/pages/api/stats.ts`
- Details UI: `src/components/reservations/details/ReservationDetailsView.tsx`
- Admin client: `src/lib/supabase-admin.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Persistence and staff APIs

#### Automated

- [ ] 1.1 New migration applies on a clean local DB
- [x] 1.2 Unit tests: Warsaw day bounds, occupancy overlap, event classification, shift ends_at > starts_at, Zod rejection of bad queries — 4bc536a
- [x] 1.3 npm run test, npm run typecheck, npm run lint pass — 4bc536a

#### Manual

- [ ] 1.4 Staff can GET events for a known seed day and see arrivals/departures JSON
- [ ] 1.5 Driver token receives 403 on the same URLs

### Phase 2: Calendar shell — day and week

#### Automated

- [x] 2.1 Component/hook tests for grouping events into Warsaw hours and applying visibility filters — 00df0e6
- [x] 2.2 Middleware tests still pass; npm run test, typecheck, lint pass — 00df0e6

#### Manual

- [ ] 2.3 Staff: day and week, prev/next, toggles hide/show layers, colors distinguishable
- [ ] 2.4 Driver visiting /kalendarz redirects to /kierowca
- [ ] 2.5 Dashboard / unchanged

### Phase 3: Month view counts

#### Automated

- [x] 3.1 Tests: reservation spanning midnight Warsaw increments occupancy on both days; arrival count only on check-in day
- [x] 3.2 npm run test, typecheck, lint pass

#### Manual

- [ ] 3.3 Month totals for a seed week match summing day-view events
- [ ] 3.4 Drill-down from a cell opens that day

### Phase 4: Operations, shift assignment, e2e

#### Automated

- [ ] 4.1 Unit tests: shift overlap allowed; driver list filters non-drivers
- [ ] 4.2 Check-in/out from details updates reservation status (unit or hook test)
- [ ] 4.3 npm run test, npm run typecheck, npm run lint pass
- [ ] 4.4 npm run test:e2e for the new driver-denied calendar cases when Playwright env is available

#### Manual

- [ ] 4.5 Click arrival → details → check-in → chip/status updates after close
- [ ] 4.6 Assign two overlapping shifts → both visible
- [ ] 4.7 Driver cannot CRUD shifts
- [ ] 4.8 /kierowca behavior unchanged
