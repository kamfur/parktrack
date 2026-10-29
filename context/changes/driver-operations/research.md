---
date: 2026-09-08T12:37:02+02:00
researcher: Auto
git_commit: 848fb6a89c271255cd051db50c856bf3674cf65b
branch: feat/driver-module
repository: parktrack
topic: "Driver ops: reuse arrivals/departures with operating-window overdue lists; staff cancel on dashboard only"
tags: [research, codebase, driver-operations, arrivals, departures, dashboard, auth, reservations]
status: complete
last_updated: 2026-09-08
last_updated_by: Auto
---

# Research: Driver ops — arrivals/departures reuse & operating-window lists

**Date**: 2026-09-08T12:37:02+02:00  
**Researcher**: Auto  
**Git Commit**: 848fb6a89c271255cd051db50c856bf3674cf65b  
**Branch**: feat/driver-module  
**Repository**: parktrack

## Research Question

Jak dziś działają przyjazdy/wyjazdy i dashboard, i co da się reuse’ować pod mobilny moduł kierowcy (`prd-v2`), z naciskiem na:

1. Listy przyjazdów/wyjazdów skupione na oknie operacyjnym osoby (nie tylko „najbliższy dzień kalendarzowy”) — np. zaplanowany przyjazd 08:00, teraz 12:00, bez potwierdzenia → nadal widoczny.
2. Anulowanie przyjazdu na dashboardzie jako ulepszenie **staff** — **nie** dla modułu kierowcy.

## Summary

Staff dashboard (`/`) już ma dwukolumnowe listy przyjazdów/wyjazdów z check-in/check-out przez `PATCH`, ale filtr SQL to **najbliższy dzień kalendarzowy ≥ today** dla `confirmed` / `in_progress` — **bez okna czasowego i bez overdue z poprzednich dni**. Same-day late (08:00 → 12:00) już widać; wczorajszy niepotwierdzony znika. Dla drivera potrzebna jest **nowa kwerenda/API** (operating window + overdue), nie sam reuse `get_todays_*`.

Model rezerwacji ma `flight_direction`, `notes`, `is_paid`, planned/actual timestamps; **brak** `passenger_count`, `parking_sector`, paid-at-arrival vs departure, dopłaty. Auth to jedna rola `authenticated` — `role?` w typach nieużywane. Cancel działa z details (`confirmed`/`in_progress` → `cancelled`); na dashboardzie **nie ma** anulowania — to świadomy backlog staff-only, poza scope drivera.

## Detailed Findings

### Arrivals / departures ops UI

- Entry: `src/pages/index.astro` → `DashboardContainer` → `useDashboard` → `TodayView` → `ArrivalsColumn` / `DeparturesColumn` → `ReservationCard`.
- Fetch: `POST /api/rpc/get_todays_arrivals`, departures via `ReservationService.getTodaysArrivals` / `getTodaysDepartures` (`src/lib/services/reservation.service.ts`).
- Polling: ~60s in `useDashboard`.
- Check-in/out from dashboard: `handleCheckIn` / `handleCheckOut` set `status` + `actual_check_in` / `actual_check_out` via `PATCH /api/reservations?id=eq.{id}` (`src/hooks/useDashboard.ts`).
- Details page (`/rezerwacje/[id]`) has ActionFooter gates, but check-in/out modals are **placeholders** (do not persist). Cancel from details **does** persist.

### Date/time filtering (critical for driver lists)

Authoritative SQL: `supabase/migrations/20260828120000_update_arrivals_departures_to_nearest.sql`

| Behavior | Arrivals | Departures |
|----------|----------|------------|
| Status filter | `confirmed` | `in_progress` |
| Day selection | nearest `date(planned_check_in) >= current_date` | nearest `date(planned_check_out) >= current_date` |
| Time-of-day | **ignored** | **ignored** |
| Same-day overdue (planned 08:00, now 12:00) | **visible** (still today) | N/A until in_progress |
| Prior-day overdue still unconfirmed | **hidden** (`>= current_date` fails) | prior-day in_progress similarly dropped if day &lt; today |

**Implication for driver module:** lists must include:

- upcoming within an operating window (shift hours later; v1 without shift module → e.g. “from start of today / now − N hours through end of day / now + M hours”), **and**
- overdue: `status = 'confirmed'` and `planned_check_in < now()` still unconfirmed (including past calendar days until cancelled/no_show/checked in).

Do **not** treat `get_todays_arrivals` as the driver query — fork or replace with an operating-window RPC/API.

### Status transitions

Enum: `confirmed` → `in_progress` → `completed` (+ `cancelled`, `no_show`).

- No server-side state machine — generic `updateReservation` after Zod (`src/lib/services/reservation.service.ts`).
- Dashboard cards disable actions when status/timestamps already set (`ReservationCard`).
- PRD workflow (expected → on lot → airport pickup → completed) is richer than today’s three operational statuses; airport-pickup may be UI-mode on `in_progress` until a dedicated status exists.

### Cancel (staff dashboard enhancement — out of driver scope)

| Surface | Cancel? |
|---------|---------|
| Dashboard cards | **No** — candidate staff enhancement |
| Reservation details | **Yes** — `cancelReservation` → `status: "cancelled"` + optional reason in `notes` (`useReservationDetails.ts`) |
| Reservations list menu | **No** — TODO / console.log |

**Product decision (this research):** adding cancel on dashboard is desirable for **staff**, explicitly **not** for the driver module.

### Reservation fields vs PRD

| PRD need | Status |
|----------|--------|
| Flight direction | Exists (`flight_direction`: `departure` \| `arrival`) |
| Notes | Exists |
| Planned/actual check-in/out | Exists |
| Coarse paid flag | Exists (`is_paid`) — not in `updateReservationSchema`; dashboard check-out does not set it |
| Passenger count | **Missing** |
| Parking sector | **Missing** |
| Paid-at-arrival vs paid-at-departure | **Missing** (only boolean) |
| Dopłata / extended stay | **Missing**; `payments` table unused in app |

Write path today: extend `updateReservationSchema` + `PATCH /api/reservations`, or add dedicated driver endpoints. Lessons prior: Zod at API boundary; form types from `z.infer`.

### Auth & routing for driver role

- Middleware: `supabaseMiddleware` → `authMiddleware` (`src/middleware/index.ts`).
- Public paths: login, auth APIs, health, external reservations (`src/middleware/auth.ts`).
- Any `locals.user` → full staff access; `role?` on `App.Locals` unused (`src/env.d.ts`).
- Staff chrome always mounted: `Layout.astro` + `Navigation.tsx` (Dashboard, Rezerwacje, Ustawienia).
- Extension points: populate role in supabase middleware; authorize prefixes in auth middleware; post-login redirect; driver layout without staff nav; tighten RLS beyond `authenticated` + `true`.

## Code References

- `supabase/migrations/20260828120000_update_arrivals_departures_to_nearest.sql` — nearest-day arrivals/departures RPCs
- `src/hooks/useDashboard.ts` — fetch, poll, check-in/out PATCH
- `src/components/dashboard/TodayView.tsx` / `ArrivalsColumn.tsx` / `DeparturesColumn.tsx` / `ReservationCard.tsx` — ops UI
- `src/pages/api/reservations.ts` — generic PATCH
- `src/lib/schemas/reservation.schema.ts` — create/update Zod
- `src/lib/services/reservation.service.ts` — RPC wrappers + `updateReservation`
- `src/hooks/useReservationDetails.ts` — cancel + notes + placeholder check-in/out
- `src/middleware/auth.ts` / `src/middleware/supabase.ts` — guards and session
- `src/components/Navigation.tsx` / `src/layouts/Layout.astro` — staff chrome
- `src/db/database.types.ts` — reservation / payment row shapes

## Architecture Insights

1. **Reuse the domain write model, not the list RPC.** Status + PATCH pattern is the reuse; list filtering must be redesigned for operating-window + overdue.
2. **Same-day late ≠ full overdue.** User example (08:00 / 12:00) already works for *today*; product ask also requires *past days still unconfirmed* — current SQL fails that.
3. **Staff cancel on dashboard is orthogonal** to driver module — plan as optional staff follow-up or separate change so it does not leak into driver cards.
4. **Schema migration required** before driver arrival card can store passengers, sector, and payment timing; `payments` table is unused inventory for dopłata.
5. **Auth is the other hard prerequisite** — without role + layout + RLS, mobile pages remain staff chrome with full access.
6. **Lessons:** Zod-first APIs; derive form VMs from schemas (`context/foundation/lessons.md`).

## Historical Context (from prior changes)

- `context/foundation/prd-v2.md` — driver module PRD; shift scoping deferred; cancel not in driver FRs.
- `context/foundation/stack-assessment-v2.md` — ready stack; optional AGENTS.md driver conventions.
- `context/foundation/health-check.md` — needs-attention on npm audit; paste driver conventions before impl.
- `context/archive/2026-09-02-testing-auth-guard/` — middleware-only API protection; unused `role?`.
- `context/changes/driver-operations/change.md` — change identity for this work.

## Related Research

- `context/archive/2026-09-02-testing-auth-guard/research.md` — auth guard behavior (if present in archive)

## Open Questions

1. **Operating window definition for v1 (no shift module):** e.g. “all overdue unconfirmed + all arrivals/departures for calendar today”, vs “now−4h … now+8h”, vs configurable settings?
2. **Past-day overdue retention:** how long until auto `no_show` / hide (never cancel from driver)?
3. **Airport pickup state:** separate status vs filter on `in_progress` + flight_direction / planned_check_out near now?
4. **Staff dashboard cancel:** same change as driver-ops or separate `staff-dashboard-cancel` change?
5. **Payment model:** extend `is_paid` + notes vs implement `payments` rows for arrival / departure / dopłata?
6. **Passenger count / sector:** free-text sector vs enum from settings?
