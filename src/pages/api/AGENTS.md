# API routes — local rules

Repo-wide rules: `@AGENTS.md`. Product/test depth: `@context/foundation/test-plan.md`.

## Adding a route

1. Create `src/pages/api/<path>.ts` (or `[param]/` folder).
2. Top of file: `export const prerender = false`.
3. Named exports only: `export const GET`, `POST`, … (uppercase).
4. Zod-validate body/query before any logic — schema in `src/lib/schemas/`.
5. Business logic in `src/lib/services/`; handler stays thin.
6. Supabase: `const supabase = context.locals.supabase` — never import `supabaseClient` in pages.

Reference shape: `@src/pages/api/settings.ts`.

## Testing

Integration tests colocated: `src/pages/api/<name>.test.ts`.  
Run one file: `npm run test -- src/pages/api/settings.test.ts`.

## Driver APIs

- Prefix: `/api/driver/*` — arrivals, departures, occupancy, reservation arrival/departure PATCH.
- `GET /api/driver/reservations/:id/quote?check_out=` — live price for the arrival/departure dialogs; unchanged date returns stored `total_cost`, otherwise `calculate_total_cost` (same rule as `trg_update_cost`); optional `vehicle_count` overrides the stored car count until the arrival is recorded.
- `POST /api/driver/reservations` — driver adds a reservation (`driverCreateReservationSchema`: no price/agency/payment fields, `source=walk_in`, audited as the user); `GET /api/driver/price` previews the price-list total for it (`vehicle_count` multiplies it).
- Multi-car reservations: `vehicle_count` (1–10) × price-list amount (before the agency discount, surcharge stays flat); car 1 plate = `license_plate`, cars 2..N = `extra_license_plates`. Internal forms/APIs only — `POST /api/reservations/external` stays single-car. `GET /api/calculate-cost` takes `vehicle_count`.
- `POST /api/driver/walk-in-arrivals` — client arrived without a reservation (driver panel + staff dashboard): `driverWalkInArrivalSchema`, creates the stay with check-in = now, then `DriverService.confirmArrival` (same rules as a booked arrival). Not atomic — if confirmation fails the reservation stays `confirmed` on the arrivals list.
- Allowed roles: `driver` and `staff`. Staff-only APIs remain blocked for drivers in `authMiddleware`.
- List window: overdue + calendar today (Warsaw), extended to now + 12h when that reaches past midnight (`pendingWindowEndIso`), for both `/api/driver/*` lists and staff dashboard `getTodaysArrivals` / `getTodaysDepartures`.
- Handled window: `GET /api/driver/arrivals` and `/departures` also return `handled` — actual timestamp on Warsaw today **or** within the last 12 hours (union).
- RLS defense-in-depth: migration `20260909140000_harden_rls_by_app_role.sql` — drivers cannot write invoices/settings; reservation UPDATEs constrained by status + column trigger.

## Staff calendar APIs

- `/api/calendar/*`, `/api/shifts*`, and `/api/drivers` are staff-only in `authMiddleware`.
- Calendar ranges and shift payloads are validated by `calendar.schema.ts`.
- Calendar events use planned timestamps and statuses `confirmed` / `in_progress`; group dates in `Europe/Warsaw`.
- `/api/drivers` uses the server-only admin client to list Auth users with `app_metadata.role=driver`.
- Driver shifts allow overlaps. The driver module remains unscoped by shifts.

## KTW arrivals on return lists

- Staff `POST /api/reservations/departures` and driver `GET /api/driver/departures` enrich after the existing query with optional `ktw_arrival_hours`.
- Fail-soft: board timeout/parse/network errors omit hours; list membership and 200 stay. Do not fail these endpoints because the board is missing.
- No new request input on those routes. If any appears later, Zod-validate it first.

## Tripwires

- Never skip auth assumption — protected routes must return 401/redirect (see `@context/foundation/test-plan.md` risk #5).
- PATCH/POST settings use admin client in handler — do not assume user RLS for writes.
- Drivers must not use `/api/reservations` — use `/api/driver/...` action routes.

## Travel agencies & agency invoices

- `/api/travel-agencies[/id]` (CRUD, `PATCH {archived}`), `/[id]/summary?month=YYYY-MM`, `/[id]/invoices` (GET, POST `{month}`) — staff-only.
- Money rules live in Postgres: discount + `is_paid` in `trg_update_cost`, month summary / issuing in `agency_month_summary` / `create_agency_invoice`, invoice locks in `trg_block_invoiced_reservation`. Handlers only map `P0001` codes (e.g. `BLOCKING_RESERVATIONS` → 409, `MONTH_NOT_CLOSED` → 422, `RESERVATION_INVOICED` → 409). Cover rule changes with pgTAP (`supabase/tests/`).
- Billing month = planned check-in in Europe/Warsaw. Agency reservations never get individual invoices.
