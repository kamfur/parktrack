---
date: 2026-09-14T11:54:00+02:00
researcher: kamil-furtak-s4d
git_commit: 21cf6fca875e8a12c4f56c6135516899d17c56b7
branch: feat/driver-module
repository: kamfur/parktrack
topic: "Staff hourly calendar of arrivals and departures (lists exist; no calendar; shifts later)"
tags: [research, codebase, dashboard, driver-ops, reservations, calendar, timezone, shifts]
status: complete
last_updated: 2026-09-14
last_updated_by: kamil-furtak-s4d
last_updated_note: "Added follow-up research for shift assignment, in-calendar operations, and month arrival/departure counts"
---

# Research: Staff hourly calendar of arrivals and departures

**Date**: 2026-09-14T11:54:00+02:00
**Researcher**: kamil-furtak-s4d
**Git Commit**: 21cf6fca875e8a12c4f56c6135516899d17c56b7
**Branch**: feat/driver-module
**Repository**: kamfur/parktrack

## Research Question

Listy przyjazdów i wyjazdów są na dashboardzie oraz w module kierowcy; kalendarza nie ma. Potrzebne: data i godzina przyjazdu oraz wyjazdu. Staff może oglądać; kierowca niekoniecznie. Później możliwe nakładanie zmiany kierowcy innym kolorem (zarządzanie zmianami).

## Summary

There is **no hourly (or any) events calendar** in the app. Staff see two **flat lists** on `/` (nearest operational day via RPCs). Drivers see three tabs on `/kierowca` (arrivals, departures, occupancy) bounded to **overdue + Warsaw today**. Arrival/departure instants live in four `timestamptz` columns: `planned_check_in`, `planned_check_out`, `actual_check_in`, `actual_check_out`. A staff calendar is **greenfield UI + a date-range API**; it must be **staff-only** (middleware + existing RLS). **Driver shift management does not exist in code** — only deferred in docs. Do not block v1 on shift colors; leave a seam (event type color: arrival vs departure) if overlay comes later.

Known-pattern priors (`context/foundation/lessons.md`): any new calendar API must **Zod-validate** query params before querying; if the calendar grows a filter form, derive types from `z.infer`, do not duplicate interfaces.

## Detailed Findings

### Staff dashboard lists (not a calendar)

Staff home is `/` → `DashboardContainer` → `TodayView` with two columns. Cards show name, optional phone/plate, **HH:mm** from `planned_check_in` (arrivals) or `planned_check_out` (departures). No hour buckets, no day navigator (only a label from the first row).

Data:

- Arrivals: `POST /api/rpc/get_todays_arrivals` → `ReservationService.getTodaysArrivals()` → RPC `get_todays_arrivals`
- Departures: `POST /api/reservations/departures` → `get_todays_departures`

Current RPC semantics (`20260828120000_update_arrivals_departures_to_nearest.sql`): **nearest calendar day ≥ `current_date`**, not overdue backlog, not a chosen date range. Sorting is planned time ascending. Stats on the same page use **Warsaw day bounds**; list RPCs use PostgreSQL `current_date` / `date(planned_*)` **without** `AT TIME ZONE 'Europe/Warsaw'` — a known mismatch.

Nav (`Navigation.tsx`): Dashboard `/`, Rezerwacje `/rezerwacje` (table, CalendarDays icon but not a calendar), Kierowca, Ustawienia. No `/kalendarz`. `STAFF_ONLY_PAGE_PREFIXES` is `/ustawienia`, `/faktury`, `/rezerwacje` plus exact `/`. A new calendar route **must be added** to staff-only prefixes or drivers will reach it.

Shadcn `Calendar` / `DateTimePicker` are **form widgets**, not an event grid. `daily_occupancy` exists but the occupancy trigger is a stub; no visual occupancy calendar in UI. `prd.md` mentioning a “visual occupancy calendar” is not implemented.

### Driver module lists (not a calendar; different window)

`/kierowca` + `DriverOpsApp`: tabs Przyjazdy / Wyjazdy / Parking. Window = **Warsaw date ≤ today** (`operating-window.ts`): all overdue + all of today; **no tomorrow**. Queries: `planned_check_in` / `planned_check_out` `< startOfTomorrowWarsawIso`, statuses `confirmed` / `in_progress`. Occupancy = all `in_progress` (no date cap).

Drivers must not get free date browsing. Staff calendar APIs must **not** live under `/api/driver/*` and must not relax RLS.

Staff can open `/kierowca` (debug); drivers hitting staff paths get 302/403 (`auth.ts`). Role from `app_metadata.role` (`resolve-app-role.ts`); missing role defaults to **staff**.

### Date and time fields

| Layer | Names |
|-------|--------|
| DB | `planned_check_in`, `planned_check_out`, `actual_check_in`, `actual_check_out` (`timestamptz`) |
| Forms | `checkInDate` / `checkOutDate` (`Date`) mapped to planned columns |
| External API | `checkInDate` / `checkOutDate` |

Constraint: `planned_check_out > planned_check_in`. Dashboard check-in/out writes **actual** times as `new Date().toISOString()`. List cards use **planned** times. Calendar v1 should decide: show planned events, actuals, or both — not specified yet.

Existing range query for staff: `GET /api/reservations?date_from=&date_to=` filters `planned_check_in >= date_from` and `planned_check_out <= date_to` (stay overlapping a range), which is **not** the same as “all arrival events and all departure events on a chosen day”. A calendar needs **two event streams** (or a union) keyed by the event timestamp, plus hour grouping client-side.

Reuse: `ReservationDto`, `ReservationCard` (or a thinner event chip), `getWarsawPeriodBounds()` in `src/pages/api/stats.ts` for day bounds.

### Access: staff yes, driver not necessarily

Confirmed by current RBAC:

- Staff-only: `/`, `/rezerwacje`, `/faktury`, `/ustawienia`, `/api/rpc/*`, `/api/reservations`, `/api/stats`, …
- Driver allowed: `/kierowca`, `/api/driver/*`

**Recommendation for this change:** staff-only page + staff-only API (e.g. `/kalendarz` + `/api/...` under a staff prefix). Do not add calendar browse to driver v1.

### Driver shifts (later color overlay)

**Verdict: not in code.** No shift table, types, or `shift` matches under `src/`. Deferred in `AGENTS.md`, `context/changes/driver-operations/plan.md` (“What We're NOT Doing”), PRD v2 / archived shape-notes.

For v1 calendar: color by **event type** (arrival vs departure) is enough. Overlay “who is on shift” needs a new domain (assignments, time ranges, which driver). Do not invent a fake shift layer.

## Code References

- https://github.com/kamfur/parktrack/blob/21cf6fca875e8a12c4f56c6135516899d17c56b7/src/pages/index.astro — staff dashboard page
- https://github.com/kamfur/parktrack/blob/21cf6fca875e8a12c4f56c6135516899d17c56b7/src/components/dashboard/TodayView.tsx — two list columns
- https://github.com/kamfur/parktrack/blob/21cf6fca875e8a12c4f56c6135516899d17c56b7/src/hooks/useDashboard.ts — fetches nearest-day RPCs
- https://github.com/kamfur/parktrack/blob/21cf6fca875e8a12c4f56c6135516899d17c56b7/src/lib/services/reservation.service.ts — `getTodaysArrivals` / `getTodaysDepartures`
- https://github.com/kamfur/parktrack/blob/21cf6fca875e8a12c4f56c6135516899d17c56b7/supabase/migrations/20260828120000_update_arrivals_departures_to_nearest.sql — nearest-day RPC SQL
- https://github.com/kamfur/parktrack/blob/21cf6fca875e8a12c4f56c6135516899d17c56b7/src/components/Navigation.tsx#L7-L12 — nav items; no calendar route
- https://github.com/kamfur/parktrack/blob/21cf6fca875e8a12c4f56c6135516899d17c56b7/src/middleware/auth.ts#L10-L22 — staff-only prefixes
- https://github.com/kamfur/parktrack/blob/21cf6fca875e8a12c4f56c6135516899d17c56b7/src/pages/kierowca/index.astro — driver page
- https://github.com/kamfur/parktrack/blob/21cf6fca875e8a12c4f56c6135516899d17c56b7/src/lib/driver/operating-window.ts — Warsaw overdue+today rule
- https://github.com/kamfur/parktrack/blob/21cf6fca875e8a12c4f56c6135516899d17c56b7/src/lib/services/driver.service.ts — driver list queries
- https://github.com/kamfur/parktrack/blob/21cf6fca875e8a12c4f56c6135516899d17c56b7/supabase/migrations/20251017120000_initial_schema.sql — `planned_*` / `actual_*` timestamptz
- https://github.com/kamfur/parktrack/blob/21cf6fca875e8a12c4f56c6135516899d17c56b7/src/pages/api/stats.ts — Warsaw period bounds (reuse for calendar days)
- https://github.com/kamfur/parktrack/blob/21cf6fca875e8a12c4f56c6135516899d17c56b7/src/pages/api/reservations.ts — existing `date_from`/`date_to` (stay overlap, not event list)

## Architecture Insights

- **Two list products, two windows:** staff = nearest future operational day (RPC); driver = backlog + today (table query). Calendar is a **third** window: user-chosen day/range, both event types, hour grid.
- **Do not reuse `get_todays_*` or `/api/driver/*`** for free browse. New staff endpoint + Zod query schema (`date` or `from`/`to`). Group by hour in the client from ISO timestamps in Europe/Warsaw.
- **Staff-only is a routing change:** add the page prefix in `auth.ts` and cover with tests like `e2e/driver-role.unauthenticated.spec.ts`.
- **Timezone:** treat Warsaw as the business calendar (driver + stats). Staff RPCs are a warning — a new calendar should use Warsaw bounds, not raw `current_date`.
- **Zod at API boundary** (lessons.md) applies to the new route before any Supabase query.

## Historical Context (from prior changes)

- `context/changes/driver-operations/plan.md` — shift-scoped lists explicitly out of v1; staff dashboard cancel deferred; driver lists must not reuse `get_todays_*`.
- `context/changes/driver-operations/research.md` — operating-window options; implemented as overdue + today.
- `context/foundation/archive/shape-notes-2026-09-14-0018.md` / `prd-v2.md` — shift module later phase.
- `context/archive/2026-08-29-statistic-dashboard/plan.md` — occupancy = live `in_progress` count; no historical occupancy chart; Warsaw for stats periods.
- `context/foundation/prd.md` — claims “visual occupancy calendar”; codebase does not have it.
- `context/foundation/prd-v3.md` — thin calendar seed only; not a source of FRs.

## Related Research

- `context/changes/driver-operations/research.md` — driver vs staff data windows and APIs

## Open Questions

1. **Route:** resolved — dedicated calendar view.
2. **Default day:** Warsaw today vs nearest operational day (current dashboard RPC)?
3. **Events:** planned times only, or also actual check-in/out as separate markers?
4. **Statuses:** confirmed + in_progress only, or also completed/cancelled on that day?
5. **Actions:** resolved — click opens operations (not browse-only).
6. **Range:** resolved — day, week, and month in v1.
7. **Shift overlay:** resolved — in scope, including assignment.
8. **Visibility toggles:** arrivals / departures / current shift independently hideable — confirm default all on?
9. **Month view:** resolved — per-day counts of arrivals and departures (not an hour grid).
10. **Shift CRUD:** resolved — assigning a driver to a shift is in this change.

## Follow-up Research 2026-09-14T12:00:00+02:00

User clarification (verbatim intent):

> zatyem chciałbym mieć osobny widok kalendarza z mozłiwośćia nawigowania i obsługi widocznośći, tydzień, dzień i miesiac. na kalendarzu widoczne przyjazdy, wyjazdy i jaki kierowca ma obecnie zmiane. przyjazdy i wyjazdy różne kolory

### Locked for planning

| Decision | Implication |
|----------|-------------|
| **Osobny widok** | New staff route (e.g. `/kalendarz`) + nav item. Do not fold into dashboard two-column lists. Add prefix to `STAFF_ONLY_PAGE_PREFIXES` in `src/middleware/auth.ts`. |
| **Nawigacja** | Prev/next + jump-to-date for the active grain (day / week / month) in Europe/Warsaw. |
| **Widoczność** | Layer toggles: arrivals, departures, current driver shift. |
| **Dzień / tydzień / miesiąc** | All three in this change. No existing scheduler in the repo (`react-day-picker` is a date picker only; `react` `scheduler` package is React internals). Greenfield calendar UI. |
| **Kolory przyjazd vs wyjazd** | Two event types, two colors. Shift layer needs a third visual language (not the same as arrival/departure). |
| **Kierowca na zmianie** | **In scope for display.** There is still **zero** shift data in `src/` or migrations. Showing “who is on shift now” requires a new persistence (who, start, end) plus an API. Driver-operations v1 explicitly deferred this. |

### Code check (follow-up)

- `grep shift` in `src/` + `supabase/migrations/*.sql`: no matches.
- No FullCalendar / react-big-calendar / similar dependency (only form `DateTimePicker`).

### Scope warning for `/10x-plan`

This is no longer “hour grid on one day reuse dashboard DTO”. It is:

1. Staff calendar page with day/week/month + navigation + visibility.
2. Event feed: planned (and/or actual — still open) arrivals and departures over the visible range.
3. **Minimal shift domain** if “kto ma obecnie zmianę” is real data, not a hardcoded name.

If shift **editing** is not wanted in this change, plan can be: read-only overlay from a small `driver_shifts` (or equivalent) table plus a tiny staff way to set “current shift” — still more than UI. If even that is too big, the calendar ships with arrival/departure colors only and a placeholder layer — user said they want it visible, so a placeholder is a product decision, not a default.

### Still open after this follow-up

Default visible date, planned vs actual markers, which reservation statuses, and visibility-toggle defaults.

## Follow-up Research 2026-09-14T13:19:00+02:00

User answers:

> Czy w tej zmianie tylko podgląd zmiany … czy też przydzielanie kierowcy do zmiany?  
> można zrobić przydzielenie  
> Czy z kalendarza robi się check-in/out, czy tylko oglądanie?  
> po kliknieciu będzie można wykonać operacje  
> Miesiąc: kropki/agenda, czy próba pełnej siatki godzin?  
> w widoku meisiaća ilośc przyjazdu i wyjazdów

### Locked

| Decision | Implication |
|----------|-------------|
| **Przydzielanie zmiany** | This change includes assigning a driver to a shift (not display-only). Needs persistence (who, start/end), staff API with Zod, UI from the calendar (create/edit assignment). Driver module stays unscoped by shift unless explicitly expanded — research still says driver lists are not shift-scoped; do not silently change `/kierowca` window in this work unless the plan says so. |
| **Operacje po kliknięciu** | Calendar is not read-only. Clicking an arrival/departure opens the same class of operations as today (staff check-in/out on dashboard; possibly driver-field updates if staff uses those flows). Reuse existing reservation mutations (`useDashboard` check-in/out and/or reservation detail) rather than a parallel state machine. Clicking a shift event/slot opens assign/edit shift. |
| **Widok miesiąca** | Each day cell shows **counts**: number of arrivals and number of departures that day (two numbers, keep arrival/departure colors). No 24h grid in month. Day and week views keep timed layout. |

### Plan notes

- Month counts must use the same timezone (Europe/Warsaw) and the same status/event definition as day/week, or the numbers will disagree with the other views.
- Shift assignment is new domain; driver-operations v1 deferred it — this change picks it up. Keep driver mobile lists as they are unless a later decision scopes lists to the assigned driver.
