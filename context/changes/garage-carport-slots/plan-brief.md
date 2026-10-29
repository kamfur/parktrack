# Garage & Carport Parking Slots — Plan Brief

> Full plan: `context/changes/garage-carport-slots/plan.md`
> PRD: `context/foundation/prd-v5.md`

## What & Why

ParkTrack's parking facility also has garage and carport spots, which today have no representation in the system. This adds them as a new, staff-managed spot type — with auto-assignment that always keeps a minimum 10h buffer against a delayed return flight, manual staff override, and a descriptive "reduce downtime" suggestion — alongside the existing regular-spot flow, unchanged.

## Starting Point

There is no spot entity in ParkTrack today — parking capacity is a single aggregate counter (`settings.total_parking_spots` vs `daily_occupancy.occupied_spots`). The only per-reservation "spot" data is a free-text `parking_sector` column with no inventory or assignment logic behind it. There's also no resource-based (per-spot) view anywhere; the calendar is purely time-based.

## Desired End State

Staff configure garage/carport units in a new configurator. When a reservation requests a garage, the system picks an available one automatically, respecting the buffer. Staff can see all garage occupancy in a simple list, manually reassign, or click "suggest optimization" for a plain-language downtime-reduction idea. Every existing view that shows a reservation (dashboard, driver, reservations list, calendar, details) now also shows a garage badge when relevant — with zero change to how regular-spot reservations behave.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Garage/spot hierarchy | Garage = 1 assignable unit; single/double is a label | Keeps assignment 1:1 with reservations and the buffer check simple | Plan |
| Reservation ↔ spot link | Separate `garage_assignments` table | Gives swaps an audit trail the optimization heuristic can use | Plan |
| Buffer enforcement | Service-layer only, one shared function | Matches the existing capacity-check convention; both auto-assign and swap call it | Plan |
| Pricing | Flat price field on the spot type | Matches the PRD's static-pricing non-goal; avoids coupling to the unrelated `pricing_rules` table | Plan |
| Occupancy view | Simple list (today + upcoming), not a resource grid | Fits the 2-week budget; no new grid-rendering component needed | Plan |
| Optimization button | Real idle-gap heuristic, not just narration | Matches PRD FR-005's intent to actually propose a swap | Plan |
| Data seeding | None — staff seeds via configurator post-deploy | Zero migration risk; resolves the PRD's blocking Open Question #4 | Plan |

## Scope

**In scope:**
- `garage_spots` + `garage_assignments` tables, `reservations.parking_type` flag
- Auto-assign + buffer-check service, manual swap, idle-gap optimization heuristic
- Garage selection on reservation creation/edit
- Garage badge on dashboard, driver, reservations list, calendar, details view
- Staff-only garage configurator and occupancy/swap view

**Out of scope:**
- Auto-executed reshuffling without staff confirmation
- Any auth/role changes or regular-spot behavior changes
- Multiple locations, dynamic/seasonal pricing
- Data migration/seeding of real garages
- Full resource-grid calendar for occupancy

## Architecture / Approach

Two new tables (`garage_spots`, `garage_assignments`) plus one new reservation column, staff-only RLS with authenticated read. A service layer owns the 10h-buffer invariant in one shared function used by both auto-assign (at reservation creation) and manual swap, so it can't be bypassed. View markers reuse the existing flight-direction badge/icon pattern already established in the reservation-details view-model.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Database schema | New tables + reservation flag, RLS | Getting the partial-unique-index / RLS shape right the first time |
| 2. Domain services + API | Buffer-check algorithm, swap, optimization heuristic, CRUD routes | The buffer algorithm itself — must be correct in both directions (before/after) |
| 3. Reservation flow | Garage selection on the form, auto-assign wiring | No-available-spot error path must be clear to staff, not a raw 500 |
| 4. View markers | Garage badge on 5 existing surfaces | Regression risk — touching 5 view families in one phase |
| 5. Configurator UI | Staff CRUD for garage spots | Low risk — new, isolated page |
| 6. Occupancy & swap view | New staff page, swap + optimization button | Scope creep — must stay a list, not grow into a grid |

**Prerequisites:** None beyond the already-generated PRD; no external service or account setup needed.
**Estimated effort:** ~2 weeks after-hours, across 6 phases (matches the PRD's acknowledged timeline).

## Open Risks & Assumptions

- The reservation-creation UI currently has no "spot type" concept at all — Phase 3 introduces it fresh; if staff expect a different entry point (e.g. a separate "garage booking" flow instead of a field on the existing form), this would need re-scoping.
- The optimization heuristic (Phase 2) is new algorithmic logic, not a data-formatting task — it carries the most design risk of any single piece in this plan.
- PRD Open Questions #1/#2/#3/#5 (why-now trigger, current workaround, backward-compat, existing integrations) remain unresolved but are non-blocking; only #4 (data migration) was blocking and is resolved by the "no seeding" decision above.

## Success Criteria (Summary)

- A garage-requesting reservation auto-assigns within the 10h buffer, and staff can swap or get an optimization suggestion — all without touching regular-spot behavior.
- The garage badge is visible wherever a reservation is already shown, and is silently absent for regular-spot reservations.
- No regression in existing reservation, dashboard, driver, or calendar flows.
