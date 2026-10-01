---
date: 2026-09-25T15:43:23+02:00
researcher: Claude (Opus 5.5) for kamfur
git_commit: 18f5fee873d5c50499c045ff896a880e53299164
branch: feat/driver-module
repository: parktrack
topic: "Mobile app (Android + iOS, Capacitor) with upcoming arrivals/departures widgets — what exists, what to reuse, what's missing"
tags: [research, codebase, mobile, capacitor, widget, auth, device-token, driver, push]
status: complete
last_updated: 2026-09-25
last_updated_by: Claude (Opus 5.5)
---

# Research: Mobile app + home-screen widgets for upcoming arrivals/departures

**Date**: 2026-09-25T15:43:23+02:00
**Researcher**: Claude (Opus 5.5) for kamfur
**Git Commit**: 18f5fee873d5c50499c045ff896a880e53299164
**Branch**: feat/driver-module
**Repository**: parktrack

## Research Question

Given the decisions in `change.md` (Capacitor wrapper, native widgets for driver+staff, single chronological list of nearest arrivals/departures with time / surname / people / flight direction, deep link on tap, dedicated read-only device token, 15–30 min refresh + silent push on status change, Android first), what in the current codebase can be reused, where do new pieces plug in, and what blocks or risks exist?

## Summary

- **Data:** no existing list fits the widget. All live lists (driver + staff dashboard) are "overdue + Warsaw today" and stop at midnight; the "nearest" SQL RPCs are **dead code** (not called from `src/`), UTC-based and `SECURITY DEFINER`. Build one small service doing two parallel queries on `reservations` (confirmed/`planned_check_in`, in_progress/`planned_check_out`) with a lower bound and no upper bound, merge, top-N. Skip KTW enrichment (live airport-board fetch, up to 3 s) and "handled" lists.
- **Auth:** everything is Supabase-cookie based (`locals.user`). Device token needs a **separate middleware branch** on an exact path that sets `locals.device` (never `locals.user`), with the read done through the **admin client** in a tiny whitelisted service — minting Supabase JWTs is worse (secret handling, `staff` claim = full write RLS). No token/crypto code exists to copy; no user deactivation concept exists at all.
- **Capacitor:** app is SSR (`output: "server"`, node standalone, cookie auth, middleware redirects) → must use `server.url` = Railway host (`https://parktrack-production.up.railway.app`); bundled assets would break cookies/CORS. No PWA/native bits exist yet.
- **Deep links:** staff has `/rezerwacje/[id]`; the driver card is a React-state modal on `/kierowca` with no URL. Adding `/kierowca?reservation=<id>` is small; login `redirectTo` already preserves `/kierowca…` for drivers and any same-origin path for staff.
- **Push trigger:** every UI arrived/departed transition (driver *and* staff screens) goes through `DriverService.applyUpdate`; staff generic `PATCH /api/reservations` can also set status (unused by UI for that). A DB AFTER UPDATE trigger is the only true choke point. No outbound integrations, realtime subscribers, `pg_net` or job queue exist; `pg_cron` is enabled.
- **Two pre-existing security holes surfaced** (verified): public, unvalidated `POST /api/reservations/external` inserting via service role; `get_todays_*` `SECURITY DEFINER` functions with no `REVOKE` → callable with the public anon key, leaking PII. Both should be fixed before a mobile client ships.

## Detailed Findings

### 1. Widget data source

- Driver list routes: `src/pages/api/driver/arrivals.ts:22-45`, `src/pages/api/driver/departures.ts:22-45` — return `{ data, handled }`; local `requireDriverOrStaff` guard (`arrivals.ts:6-20`); no input → no Zod.
- `src/lib/services/driver.service.ts`:
  - `DRIVER_LIST_SELECT` (`:23-24`) already has `last_name, first_name, planned_check_in, planned_check_out, flight_direction, passenger_count, status` (no `parking_type`).
  - `listArrivals` (`:36-51`): `status='confirmed'`, `planned_check_in < startOfTomorrowWarsaw`, asc, limit 200.
  - `fetchPendingDepartures` (`:53-68`): `status='in_progress'`, `planned_check_out < startOfTomorrowWarsaw`, asc, limit 200, then KTW enrichment (`:70-72`, `:114-119`).
- Staff equivalents `ReservationService.getTodaysArrivals` / `getTodaysDepartures` (`src/lib/services/reservation.service.ts:284-320`) — same filters, `select("*")`.
- **Window**: no lower bound → all stale overdue rows included (`src/pages/api/AGENTS.md:25`). Widget needs an explicit lower bound (e.g. `startOfWarsawTodayIso(now)` or `now - Xh`), otherwise old no-show `confirmed` rows fill it.
- **Dead RPCs**: `20260828120000_update_arrivals_departures_to_nearest.sql:4-51` returns rows on nearest date ≥ `current_date` (UTC), `security definer`; only referenced in `src/db/database.types.ts:437,474`. Do not reuse.
- **Columns** (`reservations`): `planned_check_in` / `planned_check_out` timestamptz (initial schema `:52-53`), `last_name` text not null (`:37`), `first_name` nullable (`:38`), `passenger_count` int null (`20260908140000_add_driver_operation_fields.sql:7` — filled at arrival confirmation, so **mostly null for upcoming arrivals**), `flight_direction` free text (`20260914220000_flight_direction_free_text.sql`; legacy `departure`/`arrival` values mapped by `flightDirectionLabel`, `src/lib/driver/display.ts:34-39`), `status` enum `confirmed|in_progress|completed|cancelled|no_show` (initial `:11-17`), `parking_type` (`20260921120200_...:6-8`).
- **Timezone helpers**: `src/lib/driver/operating-window.ts` — `warsawDateKey` `:11-18`, `startOfWarsawTodayIso` `:29-37`, `startOfTomorrowWarsawIso` `:43-46`, `handledWindowStartIso` `:52-56`, DST-safe `warsawOffsetMs` `:58-70`.
- **KTW enrichment cost**: `ktw-arrival-hours.service.ts:53-65` live fetch per call, no cache; adapter timeout 3000 ms (`katowice-board.adapter.ts:10`). Not needed for widget fields.
- **Tests to mirror**: chainable query mock in `src/lib/services/reservation.service.test.ts:16-54`; `driver.service.test.ts`; `operating-window.test.ts`; route 401 pattern `src/pages/api/flight-directions.test.ts`; middleware path tests `src/middleware/auth.test.ts:74-103`.

### 2. Auth & device token

- Middleware chain `src/middleware/index.ts:13`: `sequence(supabaseMiddleware, authMiddleware, rateLimiter)`.
- Cookie SSR client `src/db/supabase.server.ts:15-37`; user via `auth.getUser()` → `locals.user = {id,email,role}` (`src/middleware/supabase.ts:13-22`). Role from `resolveAppRole` (`src/lib/auth/resolve-app-role.ts:12-18`): only `"driver"` is driver, everything else → **staff (fail-open)**.
- `src/middleware/auth.ts`: public APIs `:6` (prefix match via `startsWith`, `:43`), staff-only APIs `:21-34`, no-user → 401 JSON for `/api/` (`:99-105`) else redirect (`:107-108`). `/api/widget/*` is not staff-only → open to both roles.
- Insertion point for Bearer: before `auth.ts:99`, **exact** `pathname === "/api/widget/upcoming" && GET`; set `locals.device`; never touch `locals.user` (all existing handlers check `locals.user`, e.g. `driver/arrivals.ts:7`, `drivers.ts:8`). Do **not** add to `PUBLIC_API_PREFIXES` (prefix leak).
- `Locals` typing: `src/env.d.ts:6-14` — add `device?`.
- Admin client: `src/lib/supabase-admin.ts:10-32` (null → 503 pattern), used in `drivers.ts:9`, `settings.ts:86`, `stats.ts:67`, `reservation.service.ts:121,187`.
- No existing crypto/token code; `API_SECRET_KEY` declared (`env.d.ts:24`) but unused.
- **No deactivation concept**: no profiles table, no ban usage; driver accounts are created manually in Supabase (`context/changes/driver-operations/plan.md:98,298`). "Token invalid when account deactivated" must be defined — recommended: Auth ban/delete + check `banned_until`/existence on verify + revoke all user tokens.
- RLS: role helpers read `auth.jwt()->'app_metadata'->>'role'` (`20260909140000_harden_rls_by_app_role.sql:11-42`); drivers SELECT only `confirmed`/`in_progress` (`20260909180000_...:55-62`) — widget's statuses fit. Device-token reads bypass RLS via admin client → keep `WidgetService` minimal, column-whitelisted, unit-tested.
- Rate limit: `src/middleware/rate-limit.ts:37` — 120 req/min per raw `x-forwarded-for` (spoofable, in-memory). Widget cadence is fine; consider keying by token id.
- Env: only `import.meta.env` (`env.d.ts:18-25`). Push secrets (FCM service account, APNs p8/key id/team id) → optional server-only vars; `astro:env/server` secret fields worth adopting then.
- CORS/CSP: none configured. Native HTTP clients aren't subject to CORS. Remote `server.url` keeps WebView same-origin.

### 3. Routes, deep links, Capacitor fit

- Driver module: `/kierowca` (`src/pages/kierowca/index.astro`, `DriverOpsApp client:load`; `DriverLayout` for drivers `:13`, `Layout` for staff `:17`). Only page under `kierowca/`.
- Driver card = modal in state: `src/components/driver/DriverOpsApp.tsx:34-35` (`arrivalTarget`/`departureTarget`), set on row click `:99,:108`, dialogs `:141-155`; tab in hook state `src/hooks/useDriverOps.ts:53,105`. No URL param handling today. Deep link plan: read `?reservation=<id>` after first fetch, locate in arrivals/departures, switch tab, open dialog, `history.replaceState` on close.
- Staff details: `/rezerwacje/[id]` (`src/pages/rezerwacje/[id].astro`, UUID check `:9-12`, `?edit=1`). Staff today list: `/` (`src/pages/index.astro`, dashboard cards open modals).
- Login: `src/pages/login.astro:7-9` same-origin `redirectTo`; `src/components/auth/login-form.tsx:62-69` — drivers only allowed `/kierowca…`, staff any path. Middleware redirects unauthenticated pages to `/login?redirectTo=<path+search>`.
- `astro.config.mjs`: `output: "server"`, `node({mode:"standalone"})`, no `site`/`base`/headers → Capacitor `server.url` to production host; allow-navigation for that host.
- PWA: none (`public/` only `favicon.png`; no manifest/SW/theme-color/apple-touch-icon). `DriverLayout.astro:17` already has `viewport-fit=cover`.
- Native folders: none (`android/`, `ios/`, `capacitor.config.*` absent).
- Deploy: `railway.toml` (nixpacks, `npm start`), `nixpacks.toml` providers node. Prod URL `https://parktrack-production.up.railway.app` (`context/foundation/roadmap.md:30`). Note the memory note about Nixpacks .NET-conflict: adding `android/` (Gradle) / `ios/` folders to the repo may confuse Nixpacks provider detection — `providers = ["node"]` pin should hold, verify on first deploy.

### 4. Status changes → push trigger

- Arrived = `confirmed → in_progress` (+`actual_check_in`); departed = `in_progress → completed` (+`actual_check_out`).
- App choke point: `DriverService.confirmArrival` (`driver.service.ts:136`, sets status `:148`), `completeDeparture` (`:162`, `:174`), both via `private applyUpdate` (`:197-198`).
- All UIs use driver endpoints: `useDriverOps.ts:112,130`; staff `useDashboard.ts:111,129`; `useReservationDetails.ts:241,265`.
- Bypass: staff `PATCH /api/reservations` (`src/pages/api/reservations.ts:258` → `reservation.service.ts:233,264`), schema allows `status`/`actual_check_*` (`reservation.schema.ts:89-91`); UI uses it only for cancel.
- DB: `trg_enforce_driver_reservation_update` BEFORE UPDATE (validation only); `trg_update_occupancy` AFTER trigger with empty stub body (initial `:220`). A new AFTER UPDATE trigger `WHEN (old.status IS DISTINCT FROM new.status AND new.status IN ('in_progress','completed'))` → outbox/Database Webhook/`pg_net` would be the single choke point.
- Infra present but unused: `reservations` in `supabase_realtime` publication (initial `:293`), `pg_cron` enabled (`:8`, one job `:298-311` — personal-data cleanup 1 month after checkout). No `pg_net`, webhooks, edge functions, outbound HTTP, email, FCM/APNs.
- Current refresh = 60 s polling (`useDriverOps.ts:99`, `useDashboard.ts:191`).

## Code References

- `src/lib/services/driver.service.ts:23-24` — list column projection
- `src/lib/services/driver.service.ts:36-68` — pending arrivals/departures queries (today-bounded)
- `src/lib/services/driver.service.ts:136-198` — arrival/departure transitions + `applyUpdate` choke point
- `src/lib/driver/operating-window.ts:11-70` — Warsaw time helpers
- `src/lib/driver/display.ts:30-39` — display name / flight direction labels
- `src/middleware/auth.ts:6,21-34,43,99-119` — public/staff lists, prefix match, 401/redirect
- `src/middleware/supabase.ts:10-29` — per-request client + `locals.user`
- `src/lib/auth/resolve-app-role.ts:12-18` — role resolution (fail-open to staff)
- `src/lib/supabase-admin.ts:10-32` — service-role client
- `src/env.d.ts:6-25` — `Locals` + env typing
- `src/middleware/rate-limit.ts:37` — IP-keyed in-memory limiter
- `src/components/driver/DriverOpsApp.tsx:34-35,99-155` — driver card modal state
- `src/hooks/useDriverOps.ts:53,63-65,99-130` — tabs, fetch, polling, actions
- `src/pages/rezerwacje/[id].astro:5-43` — staff details route
- `src/components/auth/login-form.tsx:15-20,62-69` — redirect handling by role
- `src/pages/api/reservations/external.ts:7-14` — **unauthenticated, unvalidated** reservation insert
- `supabase/migrations/20260828120000_update_arrivals_departures_to_nearest.sql:27,52` — **`SECURITY DEFINER` w/o REVOKE**
- `supabase/migrations/20260909180000_driver_reservation_update_allowlist.sql:16-29,55-62` — driver transition trigger + SELECT policy
- `astro.config.mjs` — SSR node standalone, no headers/security config

## Architecture Insights

- **Two auth planes, strictly separated**: cookie session (`locals.user`, RLS via user JWT) for WebView; device token (`locals.device`, admin client, one fixed read) for native widget. Separation via distinct `locals` field makes misrouting fail closed.
- **Widget service ≠ driver list service**: different window (forward-looking, no upper bound), no enrichment, minimal projection — write a new `WidgetService` rather than bending `DriverService` (whose `{data, handled}` envelope must stay stable, per `arrivals-timeline-connect/research.md:89`).
- **Remote-URL Capacitor** keeps the entire existing web stack unchanged (same origin, cookies, middleware redirects); native code limited to: token bridge plugin, widget (Glance / WidgetKit), deep-link intent handling, later push.
- **Suggested token design** (from auth track): `device_tokens(id, user_id→auth.users, installation_id, token_hash unique sha256, token_prefix, platform, device_name, scopes default '{widget:read}', push_provider, push_token, created_at, last_used_at, expires_at, revoked_at, revoked_reason)`, RLS on, writes via service role; token `ptw_` + base64url(32 random bytes), hash-lookup; endpoints `POST/GET /api/widget/devices`, `DELETE /api/widget/devices/[id]`, later `PUT /api/widget/devices/push`; verify: hash → row active → `auth.admin.getUserById` (not banned, role) → `locals.device` → throttled `last_used_at`.
- **Push later**: outbox table filled by AFTER UPDATE trigger + sender (pg_cron-polled or app-side) is more robust than app-only hook, because of the staff PATCH bypass.

## Historical Context (from prior changes)

- `context/changes/driver-operations/plan.md:33-34` — non-goals: "Offline-first", "Native mobile apps" (this change explicitly lifts the latter).
- `context/changes/driver-operations/plan-brief.md:34` — offline/native apps out of scope.
- `context/changes/driver-operations/plan.md:292` — 60 s polling deemed fine for small lots.
- `context/foundation/prd-v2.md:50,65` — pickup triggered by phone call, drivers on tablet/smartphone; `:192` offline-first out of scope.
- `context/changes/arrivals-timeline-connect/research.md:57,89` — handled window definition; list envelopes must stay stable.
- `context/changes/driver-operations/plan.md:98,298` — driver accounts provisioned manually in Supabase.
- `.ai/implementation-summary.md:192` — MVP chose polling over Supabase Realtime for simplicity.
- `context/foundation/roadmap.md:30` — production URL; `:144` camera-permission risk on driver phones (QR slice — relevant if QR scanning later moves into the native shell).
- No prior mention of PWA, widgets, FCM/APNs anywhere in `context/`.

## Related Research

- `context/changes/driver-operations/research.md`
- `context/changes/arrivals-timeline-connect/research.md`

## Open Questions

1. **Lower bound for "upcoming"**: include today's overdue items (`startOfWarsawTodayIso`) or only `now - Xh`? How to show overdue in widget (badge/colour)?
2. **`passenger_count` mostly null** for arrivals (set at arrival confirmation) — show "—", hide field, or also use another source (booking form)? The widget field "number of people" may be empty most of the time.
3. **Surname vs full name**: `last_name` only, or `driverDisplayName` (first + last)?
4. **Deactivation semantics**: introduce Auth ban + staff "deactivate driver" action in this change, or scope token validity to "user exists and not banned" and leave the UI for later?
5. **Token lifetime**: fixed expiry (e.g. 180 d sliding) vs no expiry + revocation only.
6. **Deep link for staff**: `/rezerwacje/[id]` (full page) vs dashboard `/` with dialog opened (closer to driver behaviour).
7. **Fix pre-existing holes in this change or separately**: `/api/reservations/external` (needs API key + Zod) and `REVOKE EXECUTE` on `get_todays_*` (or drop the dead RPCs).
8. **Repo layout for native projects**: `android/` + `ios/` at root (Capacitor default) vs `apps/mobile/` — and impact on Railway Nixpacks detection and ESLint/Prettier/tsc globs.
9. **iOS CI**: GitHub Actions macOS runner vs Codemagic; signing certs/profiles storage; App Group entitlement for widget ↔ app token sharing.
10. **Push sender location** (phase 3): app-side after `applyUpdate` vs DB trigger → outbox → sender; where the sender runs (Railway service has no worker today).
