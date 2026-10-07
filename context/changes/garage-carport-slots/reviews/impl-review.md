<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Garage & Carport Parking Slots Implementation Plan

- **Plan**: context/changes/garage-carport-slots/plan.md
- **Scope**: Full plan (Phases 1-6)
- **Date**: 2026-09-24
- **Verdict**: REJECTED
- **Findings**: 2 critical, 4 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Orphaned reservation row when no garage spot is available

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/reservation.service.ts:195-213
- **Detail**: `createReservation()` inserts the `reservations` row (line 195) *before* attempting garage allocation (lines 203-213). If `findAvailableSpot` returns `null`, `NoGarageAvailableError` is thrown and the API maps it to 409 — but the already-inserted reservation row is never deleted or rolled back. This leaves a real, persisted `parking_type: 'garage'` reservation with no `garage_assignments` row, invisible to the occupancy grid and inconsistent with the domain invariant ("every garage reservation has an active assignment"). Confirmed by reading the code directly — the insert precedes the allocation check with no compensating cleanup on failure.
- **Fix**: In the `parking_type === "garage"` branch, wrap the allocation call in a try/catch; on failure, delete the just-inserted reservation row (`this.supabase.from("reservations").delete().eq("id", reservation.id)`) before rethrowing, so a rejected garage request leaves no trace.
  - Strength: Small, localized change; keeps the existing two-step (insert, then allocate) structure instead of requiring a DB transaction/RPC the codebase doesn't otherwise use for this table.
  - Tradeoff: Still two round-trips (not atomic) — a crash between insert and the compensating delete would still leak a row, though this is a much smaller window than today's permanent leak.
  - Confidence: HIGH — matches the existing error-handling style in this file (typed errors, service-layer cleanup).
  - Blind spot: Whether any other code path (e.g. a future bulk-import) also creates garage reservations and would need the same guard.
- **Decision**: FIXED — reservation.service.ts:203-217, test updated in reservation.service.test.ts

### F2 — 10h buffer is enforced with a check-then-act race; nothing prevents two concurrent requests from double-booking a spot

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/garage-allocation.service.ts:114-136 (`assign`); supabase/migrations/20260921120100_add_garage_assignments.sql:19-22
- **Detail**: `assign()` reads active assignments for a spot, checks the buffer in application code, then inserts — with no transaction, lock, or DB constraint tying the check to the write. The migration's unique index only guarantees one active assignment *per reservation*, not per spot, so nothing stops two concurrent calls (e.g. an auto-assign racing a manual swap, or two auto-assigns for overlapping windows) from both passing the check and both inserting, silently violating the invariant the whole feature is built around. Confirmed: no `for update`, advisory lock, or transaction wrapping exists anywhere in the service or migration.
- **Fix A ⭐ Recommended**: Add a Postgres advisory lock keyed on `garage_spot_id` around the check-then-insert in `assign()` (`pg_advisory_xact_lock(hashtext(garageSpotId))` inside a transaction, or the supabase-js equivalent via an RPC wrapper), serializing concurrent assignments to the same spot without a schema change.
  - Strength: Keeps the deliberate "10h buffer enforced in the service layer only, not a DB constraint" decision recorded in change.md intact — this closes the race without reversing that architectural choice.
  - Tradeoff: Requires an RPC (Postgres function) since supabase-js can't take an advisory lock directly outside a single SQL statement/transaction — a small new migration for the lock-wrapping function.
  - Confidence: MEDIUM — correct in principle; exact supabase-js/RPC plumbing needs a short spike to get right.
  - Blind spot: Haven't verified how `supabase-js` batches statements inside one RPC transaction in this codebase's existing usage (e.g. `calculate_total_cost` is read-only).
- **Fix B**: Add a Postgres exclusion constraint on `garage_assignments` (via `btree_gist`) enforcing no two active, buffer-violating ranges per `garage_spot_id`.
  - Strength: The invariant becomes truly impossible to violate, even from a future direct-DB write path.
  - Tradeoff: Explicitly reverses the recorded "not a DB constraint" decision in change.md; exclusion constraints with a computed 10h buffer window are non-trivial Postgres DDL and carry real migration risk against the already-pushed remote schema.
  - Confidence: MEDIUM — technically sound but a bigger, riskier change than Fix A.
  - Blind spot: Whether the existing remote data (any assignments already created) would violate the constraint on creation, requiring cleanup first.
- **Decision**: FIXED via Fix A — new migration `20260924120000_add_assign_garage_spot_function.sql` (advisory-lock-serialized `assign_garage_spot` RPC); `garage-allocation.service.ts` `assign()` now calls the RPC instead of a JS check-then-insert. Awaiting user to run `npx supabase db push` to apply the migration to the remote project (same Docker-unavailable workaround as Phase 1).

### F3 — `updateReservation()` is garage-unaware, allowing the invariant to silently desync

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/reservation.service.ts:227-253; src/lib/schemas/reservation.schema.ts (updateReservationSchema `parking_type`)
- **Detail**: Two related gaps: (1) `updateReservationSchema` allows setting `parking_type: 'garage'` via PATCH, but `updateReservation()` never calls `GarageAllocationService` — a reservation can be flagged as needing a garage with no assignment ever created. (2) Editing `planned_check_in`/`planned_check_out` on a reservation that already has an active garage assignment does not re-validate the 10h buffer, so a date edit can silently violate the invariant enforced everywhere else.
- **Fix**: In `updateReservation()`, when the update touches `parking_type` (transitioning to `"garage"`) or the planned dates while an active garage assignment exists, run it through `GarageAllocationService` (assign if newly garage, or re-validate/re-run the buffer check if dates changed) — mirroring the guard `createReservation()` already has.
  - Strength: Closes the gap using the same service and error types already established, no new abstractions.
  - Tradeoff: Adds a read (check for an existing active assignment) to every reservation update, not just garage ones — needs to stay cheap (single indexed lookup).
  - Confidence: MEDIUM — the shape of the fix is clear; exact UX for "date edit breaks the buffer" (reject vs. re-assign) is a product decision, not just a code fix.
  - Blind spot: Whether the UI (edit form) currently exposes changing `parking_type` or dates on an existing garage reservation at all — if it doesn't, this is lower priority than it looks.
- **Decision**: FIXED (prompted by a live user bug report matching this exact finding: editing one reservation's time was silently corrupting another reservation's display in the occupancy grid). `GarageAllocationService.revalidateAssignment()` added; `reservation.service.ts` `updateReservation()` now calls it when planned dates change; `reservations.ts` PATCH maps `GarageBufferViolationError` to 409. Tests added in both files.

### F4 — `PATCH /api/garage-assignments` validates its body by hand instead of with Zod

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/garage-assignments.ts:23-29
- **Detail**: The PATCH handler checks `typeof body.reservationId !== "string"` etc. by hand, rather than validating with a Zod schema. This is the one API route in the whole change that doesn't follow the repo-wide rule recorded in `context/foundation/lessons.md` ("Always validate all incoming request data with Zod before any business logic in API routes") — every other new/modified garage route does.
- **Fix**: Add `garageAssignmentSwapSchema = z.object({ reservationId: z.string().uuid(), garageSpotId: z.string().uuid() })` to `garage-spot.schema.ts` (or a new schema file) and use `.safeParseAsync` in the PATCH handler, matching the pattern in `garage-spots.ts`.
- **Decision**: FIXED — added `garageAssignmentSwapSchema` to `garage-spot.schema.ts`, wired into the PATCH handler; test fixtures updated to use valid UUIDs.

### F5 — `garage_spots`/`garage_assignments` "authenticated read" RLS policies use a blanket `true` instead of explicit role gating

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: supabase/migrations/20260921120000_add_garage_spots.sql:26-29; supabase/migrations/20260921120100_add_garage_assignments.sql:37-40
- **Detail**: Both new tables' read policies are `for select using (true)` for any authenticated user. The rest of the codebase's shared tables (per `20260909140000_harden_rls_by_app_role.sql`) gate reads explicitly through `is_staff_role()`/`is_driver_role()`. Functionally equivalent today (only staff and driver roles exist), but it diverges from the established pattern and would silently expose data to any future role added to the system without anyone having to touch this table's policy.
- **Fix**: Add a new migration changing both read policies to `using (public.is_staff_role() or public.is_driver_role())`, matching the rest of the schema's convention.
- **Decision**: SKIPPED

### F6 — Minor plan-vs-code naming/contract drift (all functionally equivalent)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/services/garage-allocation.service.ts:85 (`findAvailableSpot` missing the plan's optional `excludeAssignmentId` param); src/components/reservations/FullReservationForm.tsx + NewReservationModal.tsx:65 (form field is `requiresGarage`, translated to `parking_type` in the modal rather than the plan's literal `parking_type` field on the form itself); src/components/reservations/details/ReservationDetailsCard.tsx (no `garageSpotIcon` prop — icon is hardcoded instead); src/components/garage/GarageSpotDialog.tsx (uses a derived `garageSpotFormSchema` rather than the plan's literally-named `createGarageSpotSchema`/`updateGarageSpotSchema`)
- **Detail**: Four small deviations from the plan's literal file/field/param names, none of which change behavior: `excludeAssignmentId` turned out unnecessary once superseded assignments are excluded by the `superseded_at is null` filter (a real simplification, not an oversight); the checkbox-then-translate form pattern reads better as UX than a raw enum field; the details-card icon is simpler as a fixed constant since only one icon is ever shown; the dialog's schema is a legitimate `.omit()` derivation needed to keep `react-hook-form`'s resolver types symmetric (this fixed a real type error during implementation).
- **Fix**: No code change needed — these are reasonable, deliberate simplifications made during implementation. Worth a one-line note in the plan's Phase 2/3/5 sections for future readers, but not required.
- **Decision**: SKIPPED

### F7 — `GarageOccupancyGrid`'s per-cell lookup is O(spots × days × entries)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/garage/GarageOccupancyGrid.tsx (`entryForDay`)
- **Detail**: Each grid cell does a linear `.find()` over all entries to check overlap, giving O(spots × days-in-month × entries) total work per render. At the garage/carport scale this feature targets (a handful of spots, a small number of active assignments), this is not a real problem — the migration notes explicitly scope out pagination/indexing concerns "operate over a single site's small garage inventory."
- **Fix**: No action needed now; if garage inventory grows into dozens of spots with heavy occupancy, pre-index entries by `garageSpotId` into a `Map` once per render instead of scanning per cell.
- **Decision**: FIXED — `entries` are now grouped into a `Map<garageSpotId, entries[]>` once per render via `useMemo`; each cell scans only its own spot's entries instead of the full list.
