---
change_id: garage-carport-slots
title: Garage & carport parking slots
status: implementing
created: 2026-09-21
updated: 2026-09-21
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
