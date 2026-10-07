# Driver Operations — Plan Brief

> Full plan: `context/changes/driver-operations/plan.md`  
> Research: `context/changes/driver-operations/research.md`

## What & Why

Airport parking drivers need a mobile ops surface for arrivals, departures, field payments, and lot status — without staff admin chrome. ParkTrack today only has a staff dashboard with nearest-day lists that drop prior-day overdue unconfirmed arrivals.

## Starting Point

Shared reservations + dashboard check-in/out via `PATCH` exist. List RPCs are nearest-calendar-day only. Auth is single-role. Missing passenger count, sector, and arrival/departure payment timing on the reservation row.

## Desired End State

Drivers with `app_metadata.role = 'driver'` use `/kierowca` to see overdue + today’s arrivals/departures, confirm arrivals, complete departures with dopłata, and view cars on lot — updating the same records staff and invoices already use.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| List window | Overdue (any past day) + calendar today | Covers 08:00→12:00 and yesterday without shift module | Plan |
| Stale overdue | Stay until staff changes status | No auto no_show complexity in v1 | Plan |
| Payments | Flags + surcharge on reservation | Faster than wiring unused `payments` table | Plan |
| Airport pickup | UI on `in_progress`, no new status | Avoid enum migration | Plan |
| Sector | Free-text | No settings UI in v1 | Plan |
| Role source | `app_metadata.role` | Clients cannot spoof; middleware-ready | Plan |
| Staff dashboard cancel | Out of scope | Orthogonal staff UX | Research |

## Scope

**In scope:** driver role + layout, operating-window APIs, arrival/departure cards, occupancy, schema fields, RLS, tests  

**Out of scope:** shifts, staff dashboard cancel, `payments` table, ad-hoc driver booking, flight APIs, offline, native apps

## Architecture / Approach

`app_metadata.role` → middleware gates → `/kierowca` mobile UI. New list/occupancy APIs (do not change staff `get_todays_*`). Driver writes go through Zod-validated reservation updates. RLS JWT claims as defense-in-depth.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Schema + role | Columns + locals.role + AGENTS conventions | Forgetting to tag driver users in env |
| 2. APIs + guards | Window lists, occupancy, update schemas, redirects | Breaking staff dashboard RPCs |
| 3. Mobile UI | Lists + arrival/departure + occupancy | Touch UX / wrong chrome |
| 4. RLS + tests | Policies + regression | Over-tight RLS blocking staff |

**Prerequisites:** local Supabase + ability to set `app_metadata.role`; research + prd-v2 accepted  
**Estimated effort:** ~3 weeks after-hours across 4 phases (matches prd timeline)

## Open Risks & Assumptions

- Default missing role → `staff` must not lock out existing users
- Sync rule between `is_paid` and new paid flags must stay consistent for invoicing
- Polish route `/kierowca` assumed for nav consistency with `/rezerwacje`

## Success Criteria (Summary)

- Driver completes arrival→departure cycle on phone without staff pages
- Overdue yesterday still appears until staff clears it
- Staff dashboard and invoices unchanged
