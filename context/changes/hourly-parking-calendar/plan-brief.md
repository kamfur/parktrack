# Staff parking calendar — Plan Brief

> Full plan: `context/changes/hourly-parking-calendar/plan.md`
> Research: `context/changes/hourly-parking-calendar/research.md`

## What & Why

Staff need one place to **browse parking traffic in time** — arrivals and departures together — instead of two operational lists that do not navigate. The calendar is the manager’s map of the lot: **day / week / month**, layer toggles, **colored** arrival vs departure, **timed driver shifts** they can assign, and **operations after click**.

## Starting Point

Today: dashboard nearest-day lists (`get_todays_*`), driver overdue+today lists, reservation table + details dialog. No calendar, no shift table, no in-app driver directory (JWT `app_metadata.role` only). Check-in on dashboard works; details-page check-in modals are still placeholders.

## Desired End State

Staff use `/kalendarz` (Warsaw today by default). Timed views show **planned** arrivals/departures for **confirmed** and **in_progress**. Month cells show **arrival count, departure count, occupancy** (planned stay overlapping that day). Click opens **reservation details** with real check-in/out. Staff CRUD **timed shifts** (overlaps allowed) picking drivers from Auth. Drivers never see this. `/kierowca` stays as-is.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Surface | Dedicated `/kalendarz` | Manager browse, not dashboard columns | Research |
| Views | Day, week, month | Asked explicitly | Research |
| Event times | Planned only | Simplest; matches list cards | Plan |
| Statuses | confirmed + in_progress | Open operational traffic only | Plan |
| Default date | Warsaw today | Aligns with stats/driver TZ | Plan |
| Driver picker | Auth `listUsers` role=driver | No profiles table | Plan |
| Click | Details dialog | Reuse `/rezerwacje/[id]` surface | Plan |
| Shift shape | start/end datetime | Needed for “who is on shift now” | Plan |
| Overlaps | Allowed, show all | User choice | Plan |
| Month occupancy | Planned-window overlap | Live snapshot is not per-day | Plan |
| Driver lists | Unchanged | Separate product | Research |

## Scope

**In scope:** Staff calendar UI + APIs; shift table/CRUD; driver directory read; month three-counts; details+mutations; middleware/e2e deny drivers.

**Out of scope:** Driver shift-scoped lists; replacing dashboard; actual-time extra markers; cancelled/completed events; month hour-grid; role-admin UI; occupancy heatmap.

## Architecture / Approach

Staff island on `/kalendarz` loads **events + shifts** for the visible Warsaw range. Events derived from `reservations.planned_*`. Shifts in `driver_shifts`. Driver IDs from Auth admin. Reservation PATCH stays in existing services. Middleware + RLS keep drivers out.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. APIs + `driver_shifts` | Events, month aggregates, shift CRUD, driver list | listUsers/service role + RLS |
| 2. Day/week UI | Nav, toggles, colors, timed layout | TZ grouping vs dashboard RPC |
| 3. Month counts | Three numbers + drill to day | Occupancy formula vs intuition |
| 4. Click ops + assign | Details mutations, shift dialog, e2e | Wiring placeholder check-in/out |

**Prerequisites:** Local Supabase, at least one Auth user with `role=driver`, staff login.
**Estimated effort:** ~4 sessions (one phase each), larger if calendar UI needs extra polish.

## Open Risks & Assumptions

- Auth `listUsers` pagination and missing emails on some users.
- Detail check-in placeholders must be wired or calendar ops stay fake.
- Occupancy-on-a-future-day counts **expected** stays, not cars physically on the lot yet.

## Success Criteria (Summary)

- Staff can navigate day/week/month, toggle layers, and see consistent month vs day numbers.
- Click → check-in/out works; overlapping shifts can be assigned and shown.
- Driver cannot open `/kalendarz` or APIs; `/kierowca` unchanged.
