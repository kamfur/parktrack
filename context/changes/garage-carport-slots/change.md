---
change_id: garage-carport-slots
title: Garage & carport parking slots
status: impl_reviewed
created: 2026-09-21
updated: 2026-09-24
archived_at: null
---

## Notes

Garage/carport as a new spot type alongside regular open-air parking, per `context/foundation/prd-v5.md`.

Planning decisions (2026-09-21):
- Garage = 1 assignable unit; single/double is a capacity/price label only, not a sub-spot hierarchy.
- Reservation ↔ garage link via a separate `garage_assignments` table (audit trail for swaps), not a FK column on `reservations`.
- 10h buffer enforced in the service layer only (matches existing capacity-check convention), not a DB constraint.
- Garage/carport pricing is a flat price field per type, not integrated into the existing `pricing_rules` table.
- Occupancy/swap view is a simple list (today + upcoming per spot), not a full resource-grid calendar.
- "Suggest optimization" computes a real idle-gap heuristic (not purely descriptive/no-op).
- No data migration/seeding — staff populates garages via the new configurator after deploy. Resolves PRD Open Question #4.

Phase 1 note (2026-09-22): migrations verified via remote push to the linked Supabase project (local Docker wasn't running).

Phase 2 note (2026-09-22): a pre-existing repo-wide lint/format debt (~551 issues, mostly CRLF/prettier mismatches in unrelated files) was confirmed NOT to include any garage-* files this change added or touched.

Phase 5 note (2026-09-23): configurator verified live in a real browser session (login done by user, clicks by agent) — create/edit/toggle all confirmed working end to end. Left a "Garaż testowy" row in the real linked Supabase project as a side effect (no delete endpoint yet); user may clean it up via Studio if desired.

Phase 6 note (2026-09-23): mid-implementation, user asked for a different occupancy UI than planned — a month grid (rows = garage spots, columns = days) with red/green day cells, instead of the simple per-spot list. This reverses that specific planning decision (see above: "Occupancy/swap view is a simple list... not a full resource-grid calendar") — the grid was built and verified live instead, including a real end-to-end auto-assign → swap flow.

Implementation review note (2026-09-24): full-plan review found 2 critical (orphaned reservation row when no garage available; check-then-act race on the 10h buffer) and 4 warning findings. Triaged: 4 fixed (orphaned-row rollback, buffer race closed via an advisory-lock RPC `assign_garage_spot`, a live user-reported bug where editing one reservation's time corrupted another's occupancy-grid display — now blocked with a 409 via `revalidateAssignment`, Zod validation added to the swap endpoint, occupancy-grid lookup pre-indexed), 2 skipped (RLS read-policy tightening, cosmetic plan-vs-code naming notes) — see `reviews/impl-review.md` for full detail. The new migration `20260924120000_add_assign_garage_spot_function.sql` still needs `npx supabase db push` (Docker unavailable locally, same workaround as Phase 1). Fixes are uncommitted pending user confirmation.
