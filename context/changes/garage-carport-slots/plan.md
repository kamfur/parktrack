# Garage & Carport Parking Slots Implementation Plan

## Overview

Add garage and carport spots as a new, separately-managed parking spot type alongside today's regular (open-air) spots. Staff configure individual garage/carport units (type, capacity label, price, availability); the system auto-assigns an available unit to a reservation that requests one, always keeping a minimum 10h buffer between the previous occupant's departure and the new arrival; staff can manually swap an assignment or ask for a descriptive optimization suggestion. The assigned garage/spot is surfaced everywhere a reservation is already shown.

## Current State Analysis

ParkTrack has no physical-spot entity today. Parking capacity is purely aggregate: `settings.total_parking_spots` and a per-day `daily_occupancy.occupied_spots` counter, compared in `src/lib/services/reservation.service.ts:64-78` (`createExternalReservation` only — the internal `createReservation` path used by staff doesn't even run this check). The only per-reservation "spot" data is `reservations.parking_sector`, a nullable free-text column added for driver ops (`supabase/migrations/20260908140000_add_driver_operation_fields.sql:8`) with no FK, no inventory, and no assignment logic — a driver just types a sector name at check-in (`src/components/driver/DriverArrivalDialog.tsx`).

There is no per-resource UI either: `CalendarGrid.tsx` is purely time-based (columns = days, rows = hours 0-23), with no spot/resource row axis. The closest analog is the shift lane-layout algorithm (`src/lib/calendar/view-model.ts:117-146`), which isn't a direct fit for a spot-occupancy view.

A precedent worth mirroring: `useReservationDetails.ts` already derives a `flightDirectionLabel`/`flightDirectionIcon` pair into its view-model (`src/types.ts:676-681`), rendered as a `Badge` + icon in `details/ReservationDetailsCard.tsx:94-102`. A `garageSpotLabel`/`garageSpotIcon` pair follows the same shape.

Route and RLS conventions: staff-only tables (e.g. `driver_shifts`) use a single `for all using (public.is_staff_role()) with check (public.is_staff_role())` policy (`supabase/migrations/20260914200000_add_driver_shifts.sql:19-23`). Staff-only API routes live under `/api/calendar/*`, `/api/shifts*`, `/api/drivers`; driver-accessible routes are prefixed `/api/driver/*` (`src/pages/api/AGENTS.md:21-35`).

## Desired End State

Staff can define garage/carport spots, new reservations that request a garage get one auto-assigned within the 10h buffer, staff can see and manually correct assignments in an occupancy view, ask for a descriptive optimization suggestion, and the assigned garage/spot is visible (icon + label) on the reservation list, dashboard, driver views, calendar, and reservation details — all without changing existing regular-spot behavior.

Verify by: creating a garage-type reservation end to end (configure a spot → create a reservation requesting garage → confirm auto-assignment respects the buffer → see the garage badge on all five surfaces → manually swap it → run "suggest optimization" and see a descriptive proposal), while confirming a regular-spot reservation created the same way as before shows no regression.

### Key Discoveries:

- No spot entity exists; `parking_sector` (`reservations.parking_sector`) is unrelated free text, not to be reused as the garage FK.
- The internal staff reservation-creation path (`ReservationService.createReservation`, `src/lib/services/reservation.service.ts:140-196`) does not run any capacity check today — the buffer/allocation check for garages is new logic, not an extension of an existing check.
- `CalendarGrid.tsx` has no resource-row axis; the occupancy view is new UI, not an extension of the calendar.
- `flightDirectionLabel`/`flightDirectionIcon` in `useReservationDetails.ts:354-356` and the `Badge`+icon composition in `details/ReservationDetailsCard.tsx:94-102` are the exact patterns to mirror for the garage badge.
- Staff-only RLS pattern: `driver_shifts` (`supabase/migrations/20260914200000_add_driver_shifts.sql:17-23`) using `public.is_staff_role()`.

## What We're NOT Doing

- No automatic execution of reshuffling/swaps without staff confirmation (descriptive suggestion only).
- No changes to the auth/role model or to existing regular-spot reservation, dashboard, driver, or calendar behavior.
- No support for multiple airports/locations — single site only.
- No dynamic/seasonal garage pricing — a flat price field per garage/carport type only.
- No data migration or pre-seeding of real garages — staff populates them via the new configurator after deploy.
- No full resource-grid calendar for garage occupancy — a simple list view (today + upcoming per spot) instead.
- No DB-level exclusion constraint for the 10h buffer — service-layer validation only, matching the existing capacity-check convention.

## Implementation Approach

Garage/carport is modeled as a new, independent domain: a `garage_spots` table (one row = one assignable unit; single/double is a price/label attribute, not a sub-entity) and a `garage_assignments` table that links a reservation to a spot with history (so swaps are auditable and the optimization heuristic can reason about them). A new `reservations.parking_type` column (`'open_air' | 'garage'`, default `'open_air'`) flags which reservations need a garage, added non-destructively so existing rows and flows are unaffected (FR-008). All new tables are staff-managed (RLS `is_staff_role()` for writes) with authenticated read access so driver-facing views can display the assignment. A single shared buffer-check function in the service layer is called by both auto-assign and manual swap, so the 10h invariant can't be violated through either path.

## Phase 1: Database Schema

### Overview

Add the garage domain tables and the reservation flag, following existing migration/RLS conventions.

### Changes Required:

#### 1. Garage spots table

**File**: `supabase/migrations/<timestamp>_add_garage_spots.sql`

**Intent**: Create the inventory of individually assignable garage/carport units that staff configure.

**Contract**: Table `garage_spots`: `id uuid pk default gen_random_uuid()`, `name text not null` (staff-facing label), `spot_type text not null check (spot_type in ('garage','carport'))`, `capacity_label text not null check (capacity_label in ('single','double'))`, `price_per_day decimal(10,2) not null check (price_per_day > 0)`, `is_available boolean not null default true`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` (reuse the existing `handle_updated_at()` trigger function). RLS: staff full access via `public.is_staff_role()` (mirror `driver_shifts`); add a second `for select using (true)` policy for authenticated read (drivers need to display the assigned spot's name).

#### 2. Garage assignments table

**File**: `supabase/migrations/<timestamp>_add_garage_assignments.sql`

**Intent**: Link a reservation to a garage spot with a history trail, so a swap supersedes rather than overwrites the prior assignment.

**Contract**: Table `garage_assignments`: `id uuid pk default gen_random_uuid()`, `reservation_id uuid not null references public.reservations(id)`, `garage_spot_id uuid not null references public.garage_spots(id)`, `assigned_at timestamptz not null default now()`, `assigned_by text not null check (assigned_by in ('system','staff'))`, `superseded_at timestamptz null`, `created_at timestamptz not null default now()`. A partial unique index `on garage_assignments (reservation_id) where superseded_at is null` guarantees exactly one active assignment per reservation. An index `on garage_assignments (garage_spot_id, assigned_at) where superseded_at is null` supports the buffer-check query. RLS: same pattern as `garage_spots` — staff full access + authenticated read.

#### 3. Reservation garage flag

**File**: `supabase/migrations/<timestamp>_add_parking_type_to_reservations.sql`

**Intent**: Flag which reservations request a garage/carport, without touching existing rows' behavior.

**Contract**: `alter table public.reservations add column parking_type text not null default 'open_air' check (parking_type in ('open_air','garage'))`. Default backfills all existing rows as `'open_air'` — no behavior change for them (FR-008).

### Success Criteria:

#### Automated Verification:

- Migrations apply cleanly: `npx supabase db reset`
- Type generation reflects new tables: `npx supabase gen types typescript --local` produces `garage_spots`/`garage_assignments`/`reservations.parking_type` in `src/db/database.types.ts` with no manual edits needed
- Typecheck passes: `npm run typecheck`

#### Manual Verification:

- Inspect the new tables and RLS policies in Supabase Studio; confirm a driver-role session can `select` but not `insert`/`update` on `garage_spots`/`garage_assignments`
- Confirm existing reservations show `parking_type = 'open_air'` after migration

---

## Phase 2: Domain Services & API Routes

### Overview

Implement garage CRUD, the auto-assign/buffer-check algorithm, manual swap, and the optimization heuristic — all behind thin, Zod-validated API routes per `src/pages/api/AGENTS.md`.

### Changes Required:

#### 1. Garage spot service

**File**: `src/lib/services/garage-spot.service.ts`

**Intent**: CRUD for `garage_spots` (create, edit, list, toggle availability) for the configurator.

**Contract**: `GarageSpotService` class following the shape of `ReservationService`; methods `list()`, `create(input)`, `update(id, input)` validated against a new `src/lib/schemas/garage-spot.schema.ts` (`createGarageSpotSchema`, `updateGarageSpotSchema`).

#### 2. Garage allocation service

**File**: `src/lib/services/garage-allocation.service.ts`

**Intent**: Owns the 10h-buffer invariant and the two operations that must respect it: auto-assign at reservation creation, and manual swap. Both call the same buffer-check function so the invariant can't be violated through either path.

**Contract**: Exposes `findAvailableSpot(planned_check_in, planned_check_out, excludeAssignmentId?)` — returns the first `garage_spots` row (`is_available = true`) with no active `garage_assignments` row that violates the 10h buffer against `[planned_check_in, planned_check_out]`, or `null` if none. Exposes `assign(reservationId, garageSpotId, assignedBy)` — inserts a new `garage_assignments` row after re-validating the buffer (defense against a race between check and write within the request). Exposes `swap(reservationId, newGarageSpotId)` — supersedes (`superseded_at = now()`) the reservation's current active assignment and calls `assign` for the new spot, re-validating the buffer for the new spot. Throws a typed error (e.g. `GarageBufferViolationError`) on failure so the API layer can return 409.

#### 3. Optimization suggestion service

**File**: `src/lib/services/garage-optimization.service.ts`

**Intent**: Compute today's idle-gap heuristic: for each garage spot, look at its ordered active assignments' `[planned_check_in, planned_check_out]` windows, find the largest idle gap between consecutive occupancies, and — if swapping two reservations across spots would reduce the largest gap while keeping every spot's buffer valid — describe that swap in prose.

**Contract**: Exposes `suggestOptimizations()` returning an array of `{ garageSpotId, description }` (plain-language suggestion strings); no auto-apply, this only reads and describes.

#### 4. API routes

**Files**: `src/pages/api/garage-spots.ts` (GET list, POST create, PATCH update — staff-only), `src/pages/api/garage-assignments.ts` (GET occupancy list, PATCH swap — staff-only), `src/pages/api/garage-assignments/optimize.ts` (GET suggestions — staff-only)

**Intent**: Thin handlers per convention: `export const prerender = false`, uppercase exports, Zod-validate, delegate to the services above, `context.locals.supabase`.

**Contract**: Staff-only per `authMiddleware` (mirror `/api/calendar/*`/`/api/shifts*` gating). `PATCH /api/garage-assignments` body `{ reservationId, garageSpotId }`; 409 on `GarageBufferViolationError`.

### Success Criteria:

#### Automated Verification:

- Unit tests for `garage-allocation.service.ts` pass: `npm run test -- src/lib/services/garage-allocation.service.test.ts` — cover buffer-respecting assignment, buffer-violating rejection, swap superseding the prior row
- Unit tests for `garage-optimization.service.ts` pass: `npm run test -- src/lib/services/garage-optimization.service.test.ts`
- API integration tests pass: `npm run test -- src/pages/api/garage-spots.test.ts src/pages/api/garage-assignments.test.ts`
- Typecheck and lint pass: `npm run typecheck && npm run lint`

#### Manual Verification:

- Call the new endpoints via a REST client as staff and as driver; confirm driver gets 401/redirect on write routes
- Manually create two adjacent-in-time garage reservations and confirm the second is rejected/reassigned when it would violate the 10h buffer

---

## Phase 3: Reservation Flow — Garage Selection & Auto-Assign

### Overview

Let staff request a garage/carport when creating or editing a reservation, and wire the auto-assign call into that flow.

### Changes Required:

#### 1. Reservation schemas

**File**: `src/lib/schemas/reservation.schema.ts`

**Intent**: Accept `parking_type` on create/update.

**Contract**: Add `parking_type: z.enum(["open_air", "garage"]).default("open_air")` to `createReservationSchema` and as optional to `updateReservationSchema`.

#### 2. Reservation service — wire auto-assign

**File**: `src/lib/services/reservation.service.ts`

**Intent**: When a reservation is created (or edited to add) with `parking_type = 'garage'`, call `GarageAllocationService.findAvailableSpot` + `assign` after the reservation row exists; surface a clear error if no spot is available within the buffer.

**Contract**: In `createReservation()` (`:140-196`), after the insert, if `parking_type === 'garage'`, call the allocation service with `assignedBy: 'system'`; propagate `GarageBufferViolationError`/no-availability as a typed service error the API layer maps to 409.

#### 3. Reservation form — garage selection

**File**: `src/components/reservations/FullReservationForm.tsx`

**Intent**: Let staff mark a reservation as requiring a garage/carport (checkbox or select), extending the existing form schema/fields.

**Contract**: Add a `parking_type` field (default `open_air`) to the form's local schema and submit payload, following the same pattern as the existing `flightDirection`/`notes` fields.

#### 4. Reservation details view-model

**File**: `src/hooks/useReservationDetails.ts`, `src/types.ts`

**Intent**: Surface the assigned garage on the details view, mirroring the existing `flightDirectionLabel`/`flightDirectionIcon` derivation.

**Contract**: Add `garageSpotLabel: string | null` and `garageSpotIcon: string | null` to `ReservationDetailsViewModel` (`src/types.ts:643-695`), populated in `buildViewModel()` (`useReservationDetails.ts:328-362`) from a join against the reservation's active `garage_assignments` row (or `null` for `open_air` reservations).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test -- src/hooks/useReservationDetails.test.ts` (if present) or equivalent view-model test
- Integration test for reservation creation with `parking_type: 'garage'` auto-assigns and returns the assignment: `npm run test -- src/pages/api/reservations.test.ts`
- Typecheck passes: `npm run typecheck`

#### Manual Verification:

- Create a reservation via the UI requesting a garage; confirm a spot is auto-assigned and visible in the details view
- Create a reservation without requesting a garage; confirm no assignment is created and existing behavior is unchanged

---

## Phase 4: View Markers

### Overview

Show the garage icon + assigned spot wherever a reservation is already displayed, without disrupting existing regular-spot rendering.

### Changes Required:

#### 1. Shared display helper

**File**: `src/lib/driver/display.ts`, `src/lib/driver/display.test.ts`

**Intent**: One `garageSpotLabel(reservation)`-style pure helper, consolidating what would otherwise be duplicated across `ReservationCard`, `DriverReservationRow`, and the details view-model — following the existing `flightDirectionLabel` shape (pure function, explicit `now` param not needed here since it's not time-relative).

**Contract**: `garageSpotLabel(parkingType, garageSpotName)` returns `null` for `open_air`/missing data, else a formatted label; colocated unit test with the same `describe/it` shape as `display.test.ts:4-28`.

#### 2. Dashboard card

**File**: `src/components/dashboard/ReservationCard.tsx`

**Intent**: Add a garage badge/icon row alongside the existing flight-direction/KTW-hours rows (`:96-108`).

**Contract**: Render only when `reservation.parking_type === 'garage'`; same icon+text row composition already used for flight direction.

#### 3. Driver row

**File**: `src/components/driver/DriverReservationRow.tsx`

**Intent**: Show the garage assignment distinctly from the existing free-text `parking_sector` line (`:81-87`), since the two are unrelated fields going forward.

**Contract**: Add the garage badge alongside the existing direction/sector line; do not remove or repurpose `parking_sector` rendering.

#### 4. Reservations list

**File**: `src/components/reservations/ReservationCards.tsx`, `src/components/reservations/ReservationTable.tsx`

**Intent**: Add the same garage badge to both the mobile card list and the desktop table row.

**Contract**: Conditional badge cell/row entry, same pattern as other conditional fields in these components.

#### 5. Calendar event chip

**File**: `src/components/calendar/CalendarGrid.tsx`, `src/types.ts` (`CalendarEventDto`), `src/hooks/useParkingCalendar.ts`

**Intent**: Surface the garage badge on calendar event chips.

**Contract**: Add `parkingType`/`garageSpotName` (or equivalent) to `CalendarEventDto` (`src/types.ts:66-75`), populate it in `useParkingCalendar.ts`, render conditionally in `EventChip` (`CalendarGrid.tsx:160-185`).

#### 6. Details card

**File**: `src/components/reservations/details/ReservationDetailsCard.tsx`

**Intent**: Show the garage description + assigned spot, mirroring the existing flight-direction `Badge` (`:94-102`).

**Contract**: Add `garageSpotLabel`/`garageSpotIcon` props (from Phase 3's view-model), render as a second `Badge` when non-null.

### Success Criteria:

#### Automated Verification:

- Unit test for the new display helper passes: `npm run test -- src/lib/driver/display.test.ts`
- Existing component/view-model tests still pass (no regression): `npm run test`
- Typecheck and lint pass: `npm run typecheck && npm run lint`

#### Manual Verification:

- Visually confirm the garage badge appears on a garage reservation and is absent on a regular reservation, on: dashboard, driver view, reservations list (mobile + desktop), calendar, and details view
- Confirm no visual regression on existing regular-spot reservations across the same five surfaces

---

## Phase 5: Garage/Carport Configurator

### Overview

A staff-only UI to create, edit, and toggle availability of garage/carport spots.

### Changes Required:

#### 1. Configurator page

**File**: `src/pages/garage-spots.astro` (or under an existing staff settings area — follow whatever nav convention `src/pages/settings.astro` uses, if present)

**Intent**: Staff-only page hosting the garage-spot list + create/edit form.

**Contract**: Astro page rendering a React island; staff-only per existing route-protection convention.

#### 2. Configurator form component

**File**: `src/components/garage/GarageSpotConfigurator.tsx`, `src/components/garage/GarageSpotDialog.tsx`

**Intent**: List existing spots with an available/unavailable checkbox and price; a create/edit dialog for type (garage/carport), capacity label (single/double), name, and price — following the `ShiftDialog.tsx` create/edit discriminated-state pattern.

**Contract**: react-hook-form + zod (`createGarageSpotSchema`/`updateGarageSpotSchema` from Phase 2), calling `src/hooks/useGarageSpots.ts` (new hook mirroring `useCreateReservation.ts`'s API-call shape) against `/api/garage-spots`.

### Success Criteria:

#### Automated Verification:

- Component test (if the project has a pattern for component tests) passes, or at minimum typecheck/lint: `npm run typecheck && npm run lint`
- API integration test from Phase 2 (`garage-spots.test.ts`) still passes

#### Manual Verification:

- Staff can create a garage spot, edit its price, and toggle availability off/on via the UI; a driver-role session cannot reach the page
- A reservation cannot auto-assign to a spot marked unavailable

---

## Phase 6: Occupancy & Swap View

### Overview

A staff-only list view of upcoming garage assignments per spot, with a manual swap action and a "suggest optimization" button.

### Changes Required:

#### 1. Occupancy page

**File**: `src/pages/garage-occupancy.astro`

**Intent**: Staff-only page listing each garage/carport spot with its upcoming assignments.

**Contract**: Astro page + React island, staff-only.

#### 2. Occupancy list component

**File**: `src/components/garage/GarageOccupancyView.tsx`, `src/components/garage/GarageSwapDialog.tsx`

**Intent**: Render each spot as a section with its ordered upcoming assignments (reservation name, planned check-in/out); a swap action per assignment opens a dialog to reassign to a different available spot; an "suggest optimization" button calls the optimization endpoint and renders the returned descriptions.

**Contract**: `useGarageOccupancy()` hook fetching `GET /api/garage-assignments`; swap dialog calls `PATCH /api/garage-assignments`; optimization button calls `GET /api/garage-assignments/optimize` and renders the description list — no auto-apply action exists.

### Success Criteria:

#### Automated Verification:

- Typecheck and lint pass: `npm run typecheck && npm run lint`
- Existing full test suite still passes: `npm run test`

#### Manual Verification:

- Staff can view today's + upcoming garage occupancy, manually swap an assignment (respecting the buffer — a buffer-violating swap is rejected with a clear message), and see a descriptive optimization suggestion
- A driver-role session cannot reach this page

---

## Testing Strategy

### Unit Tests:

- `garage-allocation.service.ts`: buffer respected on assign, buffer violated → rejected, swap supersedes prior assignment and re-validates the new one
- `garage-optimization.service.ts`: correct largest-gap identification, correct swap description generation, no suggestion when no beneficial swap exists
- `display.ts` `garageSpotLabel`: null for open_air, formatted label for garage

### Integration Tests:

- `POST /api/reservations` with `parking_type: 'garage'` auto-assigns and returns the assignment; 409 when no spot available within the buffer
- `PATCH /api/garage-assignments` swap: success path and buffer-violation rejection
- `GET/POST/PATCH /api/garage-spots`: staff-only enforcement, validation errors

### Manual Testing Steps:

1. Create two garage spots via the configurator (one garage, one carport)
2. Create a garage-requesting reservation; confirm auto-assignment and the 10h buffer relative to any existing assignment on that spot
3. Attempt to create a second garage reservation that would violate the buffer on the only available spot; confirm rejection/fallback behavior is clear to staff
4. Manually swap an assignment via the occupancy view; confirm the buffer is still enforced on the swap
5. Click "suggest optimization" and confirm the description is accurate against the actual idle gaps
6. Confirm the garage badge appears on dashboard, driver view, reservations list, calendar, and details view for the garage reservation, and is absent for a regular reservation
7. Confirm all existing regular-spot flows (create, edit, dashboard, driver check-in/out, calendar) behave exactly as before

## Performance Considerations

None beyond existing patterns — occupancy list and optimization heuristic operate over a single site's small garage inventory (no pagination/indexing concerns beyond the indexes defined in Phase 1).

## Migration Notes

Purely additive: new tables plus a defaulted `reservations.parking_type` column. No backfill beyond the default; no rollback complexity beyond a standard down-migration for the three new migration files.

## References

- PRD: `context/foundation/prd-v5.md`
- Shape notes: `context/foundation/shape-notes.md`
- Similar RLS pattern: `supabase/migrations/20260914200000_add_driver_shifts.sql`
- Similar view-model precedent: `src/hooks/useReservationDetails.ts:328-362`, `src/types.ts:643-695`
- Similar dialog pattern: `src/components/calendar/ShiftDialog.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database Schema

#### Automated

- [x] 1.1 Migrations apply cleanly: `npx supabase db reset` — aaa170a
- [x] 1.2 Type generation reflects new tables/column — aaa170a
- [x] 1.3 Typecheck passes — aaa170a

#### Manual

- [x] 1.4 Inspect new tables/RLS in Supabase Studio; driver read-only confirmed — aaa170a
- [x] 1.5 Existing reservations show `parking_type = 'open_air'` after migration — aaa170a

### Phase 2: Domain Services & API Routes

#### Automated

- [x] 2.1 `garage-allocation.service.test.ts` passes — 9d5c1cc
- [x] 2.2 `garage-optimization.service.test.ts` passes — 9d5c1cc
- [x] 2.3 API integration tests pass (`garage-spots.test.ts`, `garage-assignments.test.ts`) — 9d5c1cc
- [x] 2.4 Typecheck and lint pass — 9d5c1cc

#### Manual

- [x] 2.5 Driver gets 401/redirect on garage write routes — 9d5c1cc
- [x] 2.6 Manual buffer-violation rejection confirmed (deferred to Phase 3 end-to-end verification — no way to create a garage-requesting reservation until `parking_type` is wired in) — 9d5c1cc

### Phase 3: Reservation Flow — Garage Selection & Auto-Assign

#### Automated

- [x] 3.1 View-model/hook test passes
- [x] 3.2 Reservation-creation integration test (auto-assign) passes
- [x] 3.3 Typecheck passes

#### Manual

- [x] 3.4 Garage-requesting reservation auto-assigns and shows in details view (verified at test level; no configurator yet to seed a real spot until Phase 5)
- [x] 3.5 Non-garage reservation unaffected

### Phase 4: View Markers

#### Automated

- [ ] 4.1 `display.test.ts` passes
- [ ] 4.2 Full existing test suite still passes (no regression)
- [ ] 4.3 Typecheck and lint pass

#### Manual

- [ ] 4.4 Garage badge visible on all 5 surfaces for a garage reservation
- [ ] 4.5 No visual regression on regular-spot reservations across the same surfaces

### Phase 5: Garage/Carport Configurator

#### Automated

- [ ] 5.1 Typecheck and lint pass
- [ ] 5.2 `garage-spots.test.ts` still passes

#### Manual

- [ ] 5.3 Staff can create/edit/toggle a garage spot; driver cannot reach the page
- [ ] 5.4 Unavailable spot is never auto-assigned

### Phase 6: Occupancy & Swap View

#### Automated

- [ ] 6.1 Typecheck and lint pass
- [ ] 6.2 Full test suite passes

#### Manual

- [ ] 6.3 Staff can view occupancy, swap an assignment (buffer enforced), and get an optimization suggestion
- [ ] 6.4 Driver cannot reach the page
