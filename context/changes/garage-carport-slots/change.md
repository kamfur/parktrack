---
change_id: garage-carport-slots
title: Garage & carport parking slots
status: implemented
created: 2026-09-21
updated: 2026-09-23
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
