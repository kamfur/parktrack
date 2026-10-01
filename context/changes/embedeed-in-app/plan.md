# Mobile App (Android + iOS) with Upcoming Arrivals/Departures Widgets — Implementation Plan

## Overview

Ship ParkTrack as an internally distributed Android and iOS app: a Capacitor shell that loads the production web app, plus native home-screen widgets showing one chronological list of the nearest arrivals and departures (time, surname, people, flight direction). Tapping an item deep-links to the reservation card. Widgets authenticate with a dedicated read-only device token, refresh every 15–30 min, and get a silent push when a reservation is marked arrived/departed so other drivers don't double up on pickups. Android ships first; iOS is built on cloud macOS CI; push comes last. Two pre-existing security holes are fixed first so the mobile client doesn't launch on a leaky backend.

## Current State Analysis

- **No list fits the widget.** Driver and staff lists are "overdue + Warsaw today", bounded by `startOfTomorrowWarsawIso`, so they're empty of tomorrow's items late in the evening (`src/lib/services/driver.service.ts:36-68`, `src/lib/services/reservation.service.ts:284-320`). Departure lists also do a live KTW airport-board fetch (up to 3 s, no cache) that the widget doesn't need (`src/lib/services/ktw-arrival-hours.service.ts:53-65`).
- **The "nearest" RPCs are dead and dangerous.** `get_todays_arrivals` / `get_todays_departures` aren't called from `src/`, use UTC `current_date`, and are `SECURITY DEFINER` with no `REVOKE`, so anyone holding the public anon key can read reservation PII (`supabase/migrations/20260828120000_update_arrivals_departures_to_nearest.sql:27,52`).
- **External reservation endpoint is open.** `POST /api/reservations/external` is on the public API list (`src/middleware/auth.ts:6`), checks no key, and never uses the existing `createExternalReservationSchema` (`src/pages/api/reservations/external.ts:7-14`; schema tested in `src/lib/schemas/reservation.schema.test.ts:29+`). Its real consumer is the parking's public website (`.ai/auth-spec.md:80`). The earlier design already called for `X-API-Key` checked against `API_SECRET_KEY` with a constant-time comparison (`.ai/reservations-implementation-plan.md:77`); `API_SECRET_KEY` is declared but unused (`src/env.d.ts:24`).
- **Auth is cookie-only.** The per-request Supabase SSR client sets `locals.user` (`src/middleware/supabase.ts:10-29`); every handler checks `locals.user`. There's no token/crypto code and no user-deactivation concept, and driver accounts are provisioned by hand in Supabase (`context/changes/driver-operations/plan.md:98,298`). Role is fail-open to `staff` (`src/lib/auth/resolve-app-role.ts:12-18`).
- **The driver card has no URL.** It's modal state in `src/components/driver/DriverOpsApp.tsx:34-35`, the tab is hook state in `src/hooks/useDriverOps.ts:53`, and nothing reads the query string. Staff have `/rezerwacje/[id]` (`src/pages/rezerwacje/[id].astro`).
- **No native/PWA assets.** There's no `android/`, `ios/`, `capacitor.config.*`, or manifest; `public/` holds only `favicon.png`. The app is SSR (`output: "server"`, node standalone) with cookie auth, so Capacitor has to load `server.url`. Prod is `https://parktrack-production.up.railway.app` (`context/foundation/roadmap.md:30`).
- **Status transitions.** Every UI arrival/departure goes through `DriverService.applyUpdate` (`driver.service.ts:197-198`). Staff `PATCH /api/reservations` can also set `status` (`src/pages/api/reservations.ts:258`, schema `reservation.schema.ts:89-91`). `pg_cron` is enabled; there are no outbound integrations, `pg_net`, or workers.
- **CI** is one ubuntu job: `test → lint → build` (`.github/workflows/ci.yml`). Root `tsconfig.json` includes `**/*`, and ESLint ignores only `src/components/ui/**` plus `.gitignore` entries.

## Desired End State

- A driver or staff member installs the internal build (Play internal testing / TestFlight), logs in once inside the app, and adds the ParkTrack widget.
- The widget lists the nearest N items (small 2–3, large 5–6), mixed and sorted by planned time:
  - ↓ arrival / ↑ departure icon, time (Europe/Warsaw), surname, people count (hidden when unknown), flight direction;
  - overdue items (planned time already passed today) highlighted.
- Tapping an item opens the app on the right card: driver → `/kierowca?reservation=<id>` with its dialog open; staff → `/rezerwacje/<id>`. Tapping the header opens today's list (`/kierowca` or `/`).
- When any reservation turns `in_progress` or `completed`, every registered device gets a silent push and its widget refreshes within about a minute (best effort). Otherwise the widget refreshes every 15–30 min.
- Tokens are read-only, per device, and expire 90 days after last use. Staff can list and revoke devices in `/ustawienia`, and banned or deleted Supabase users are rejected on the next widget call.
- `get_todays_*` RPCs are gone; `/api/reservations/external` requires `X-API-Key` and validates with Zod.

Verification: CI green (web + Android build; iOS TestFlight workflow), unit/integration tests for token, widget, and external services and routes, one E2E for the deep link, and a manual device run-through on a physical Android phone and a TestFlight iPhone.

### Key Discoveries:

- `DRIVER_LIST_SELECT` already has every widget column (`driver.service.ts:23-24`); `last_name` is non-null; `passenger_count` is set at arrival confirmation, so it's usually null for arrivals (`20260908140000_add_driver_operation_fields.sql:7`).
- Warsaw time helpers already exist: `startOfWarsawTodayIso` (`src/lib/driver/operating-window.ts:29-37`), DST-safe offset (`:58-70`). `flightDirectionLabel` maps legacy values (`src/lib/driver/display.ts:34-39`).
- Admin client pattern (null → 503): `src/lib/supabase-admin.ts:10-32`.
- Prefix matching on public paths (`auth.ts:43`), so the device branch must use exact path equality, never a new public prefix.
- Middleware order: supabase → auth → rateLimiter (`src/middleware/index.ts:13`). The rate limiter keys on raw `x-forwarded-for`, in memory (`src/middleware/rate-limit.ts:37`).
- Login redirect for drivers accepts only `/kierowca` or `/kierowca/…` (`src/components/auth/login-form.tsx:62-69`). `/kierowca?reservation=x` matches neither and would be dropped (see Critical Implementation Details).
- Query-builder mock pattern for service tests: `src/lib/services/reservation.service.test.ts:16-54`; route 401 pattern: `src/pages/api/flight-directions.test.ts`; middleware path tests: `src/middleware/auth.test.ts:74-103`.

## What We're NOT Doing

- A full native UI (React Native/Expo) or offline-first mode. The app is a WebView over prod and needs network (`prd-v2.md:192`).
- Public App Store / Play Store listing; internal distribution only.
- Shift-scoped or per-driver-assigned widget content. Driver and staff see the same list; shifts stay unscoped (`src/pages/api/AGENTS.md`).
- In-app "deactivate driver" account management. Bans and deletions stay in the Supabase dashboard; we only honour them and offer device revocation.
- Adding expected passenger count to booking forms or the external API.
- Live Activities, lock-screen-specific privacy toggles, widget configuration (choose arrivals only, etc.), multiple widget types.
- Push for new/cancelled/rescheduled reservations. Those are picked up by the periodic refresh (accepted risk, `change.md`).
- Reviving or reusing the `get_todays_*` RPCs, or KTW hours in the widget.

## Implementation Approach

Two strictly separated auth planes. The **WebView plane** is unchanged: cookie session, `locals.user`, RLS via user JWT. The **device plane** is new: `Authorization: Bearer ptw_…`, accepted only on exact widget paths, setting `locals.device` and never `locals.user`, with reads done through the admin client inside one tiny, column-whitelisted `WidgetService`. Existing handlers check `locals.user`, so a misrouted device token fails closed.

The server owns all presentation decisions the native widgets would otherwise duplicate in Kotlin and Swift: role-specific deep-link paths, the flight-direction label, the overdue flag. Native widgets render the payload as-is.

The native shell lives in `apps/mobile/` (its own `package.json`), so the Railway/Nixpacks root build and the server image don't change. The web code detects the native runtime through the `window.Capacitor` global that Capacitor injects into remote pages, so the root app takes no `@capacitor/*` dependency.

Push goes through an outbox: a DB trigger on status change, drained by an app-side sender. It catches both driver and staff write paths and survives send failures.

## Critical Implementation Details

- **Device branch must precede the no-user check and ignore cookies.** In `authMiddleware`, when `request.method` matches and `pathname` is exactly one of the device paths (`GET /api/widget/upcoming`; later `PUT /api/widget/devices/push`) and an `Authorization: Bearer` header is present, verify the token and `return next()` with only `locals.device` set, regardless of any cookie user. Without a bearer header those paths fall through to normal cookie auth (the WebView may call `/api/widget/upcoming` for debugging). Don't let `supabaseMiddleware` fail the request because there are no cookies; it already tolerates anonymous requests.
- **Deep-link redirect preservation.** `login-form.tsx:62-69` and middleware `isDriverHomePath` have to compare the *pathname* of `redirectTo` (strip `?…`/`#…`), otherwise `/kierowca?reservation=<id>` is dropped after a re-login. Keep the same-origin guard (`/` but not `//`).
- **Native → WebView navigation must stay same-origin.** The widget passes only a relative `open_path` (for example `parktrack://open?path=%2Fkierowca%3Freservation%3D…`). The shell accepts it only if it starts with `/` and not `//`, then loads `server.url + path`. Never load an absolute URL from an intent or URL extra.
- **iOS project without a Mac.** Capacitor generates `ios/App/App.xcodeproj`. Add the widget extension target once with an idempotent Ruby `xcodeproj` script run on the macOS CI runner, using an Xcode 16 *synchronized folder* (`PBXFileSystemSynchronizedRootGroup`) for `ParkTrackWidget/`. Later Swift file additions then never touch `project.pbxproj`, so iteration works without Xcode. Commit the resulting `project.pbxproj` from the CI artifact.
- **Token issuance ordering.** `POST /api/widget/devices` revokes any active token for the same `(user_id, installation_id)` *before* inserting the new one; the partial unique index enforces this. On logout, the web code calls `DELETE /api/widget/devices/<id>` for the current device and the native `clearToken()` *before* the Supabase sign-out, while the cookie session is still valid.
- **Silent push on iOS is best effort.** iOS may throttle or drop `content-available` pushes. The app calls `WidgetCenter.shared.reloadAllTimelines()` when it gets one, and the 15–30 min timeline remains the guarantee. That's acceptable per `change.md`.

## Phase 0: Security Hardening

### Overview

Close the two holes found in research before any mobile client exists: drop the dead PII-leaking RPCs, and put machine auth plus Zod validation on the external reservation endpoint.

### Changes Required:

#### 1. Drop dead RPCs and audit SECURITY DEFINER exposure

**File**: `supabase/migrations/<ts>_drop_get_todays_rpcs.sql` (new)

**Intent**: Remove `get_todays_arrivals` / `get_todays_departures` (unused, bypass RLS, callable by anon). Audit the other `security definer` functions in `20251017120000_initial_schema.sql` (`:208,217,235,371`): trigger functions are fine, but any that is RPC-callable gets `REVOKE EXECUTE … FROM anon, public` (keep `authenticated` only if something in `src/` uses it).

**Contract**: `drop function if exists public.get_todays_arrivals(...)` / `public.get_todays_departures(...)` with their exact signatures; regenerate `src/db/database.types.ts` so the `Functions` entries disappear (`:437,474`).

#### 2. External API key + Zod

**File**: `src/pages/api/reservations/external.ts`, `src/lib/auth/api-key.ts` (new), `src/env.d.ts`

**Intent**: Require `X-API-Key` matching `API_SECRET_KEY` (constant-time compare over SHA-256 digests, so length differences don't leak), return 503 when the env var is unset (fail closed), then `safeParse` the body with `createExternalReservationSchema` and return 400 with issues. The route stays on the middleware public list, since this is machine auth in the handler.

**Contract**: `verifyApiKey(header: string | null, secret: string | undefined): "ok" | "missing_secret" | "invalid"`. Responses are 401 `{ error: "unauthorized" }`, 503 `{ error: "not_configured" }`, and 400 `{ error: "validation_error", details }`. `API_SECRET_KEY` stays optional in `ImportMetaEnv`.

#### 3. Tests

**File**: `src/pages/api/reservations/external.test.ts` (new), `src/lib/auth/api-key.test.ts` (new)

**Intent**: Cover missing, wrong, and correct keys; unset secret → 503; invalid body → 400; happy path → 201 with the service mocked.

**Contract**: Mirrors the route test pattern in `src/pages/api/flight-directions.test.ts`.

### Success Criteria:

#### Automated Verification:

- Migrations apply cleanly on a fresh local DB: `npx supabase db reset`
- Unit/integration tests pass: `npm run test`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- No reference to `get_todays_` remains in `src/`: `grep -r "get_todays_" src` returns nothing

#### Manual Verification:

- The public parking website is updated to send `X-API-Key` *before* enforcement deploys; after deploy, a real booking from the website still creates a reservation
- `API_SECRET_KEY` is set in Railway (prod + preview envs)
- Calling `rpc/get_todays_arrivals` with the anon key against the hosted project returns "function not found"

**Implementation Note**: After automated checks pass, pause for manual confirmation. The deploy order matters: website sends the header → set env → deploy.

---

## Phase 1: Device Tokens and Widget API

### Overview

Add the device-token data model, the bearer branch in middleware, device registration/list/revoke endpoints, and the `GET /api/widget/upcoming` endpoint that native widgets consume.

### Changes Required:

#### 1. `device_tokens` table

**File**: `supabase/migrations/<ts>_add_device_tokens.sql` (new)

**Intent**: Store hashed per-device tokens with push fields ready for Phase 6, RLS on, no client policies, and all access through the service role.

**Contract**: columns `id uuid pk`, `user_id uuid → auth.users on delete cascade`, `installation_id text not null`, `token_hash text unique not null` (sha256 hex), `token_prefix text not null`, `platform text check in ('android','ios')`, `device_name text`, `scopes text[] default '{widget:read}'`, `push_provider text check in ('fcm','apns') null`, `push_token text null`, `created_at`, `last_used_at`, `expires_at timestamptz not null`, `revoked_at`, `revoked_reason`. Partial unique index `(user_id, installation_id) where revoked_at is null`. `alter table … enable row level security` with no policies. Regenerate `database.types.ts`.

#### 2. Device token service

**File**: `src/lib/services/device-token.service.ts` (new)

**Intent**: Issue, verify, touch, list, and revoke tokens. The raw token is `ptw_` + base64url(32 random bytes), returned once; only its SHA-256 is stored. On verify:
- look up the row by hash; it must be unrevoked and `expires_at > now`;
- `auth.admin.getUserById` must return a user that exists and isn't banned (`banned_until` in the past or null), with the role resolved via `resolveAppRole`;
- cache the user check for 60 s in memory;
- slide `expires_at = now + 90 d` and set `last_used_at`, throttled to once per hour per token.

On a banned or missing user, revoke the row with reason `user_inactive`.

**Contract**:
- `issue(admin, { userId, installationId, platform, deviceName }) → { id, token, expiresAt }`
- `verify(admin, rawToken, now) → { tokenId, userId, role } | null`
- `revoke(admin, id, reason)`
- `revokeAllForUser(admin, userId, reason)`
- `list(admin) → DeviceDto[]`, joined with user emails via the existing driver-directory / `admin.listUsers` approach

Throws a `DeviceTokenServiceError(msg, statusCode)` in the style of `DriverServiceError`.

#### 3. Widget service

**File**: `src/lib/services/widget.service.ts` (new)

**Intent**: The one read the device plane can do. Run two parallel queries on `reservations` with the admin client, merge them, and project to the widget DTO. No KTW enrichment, no handled lists.

**Contract**: `listUpcoming(admin, { now, limit, role }) → WidgetUpcomingResponseDto`.
- Arrivals: `status = 'confirmed' AND planned_check_in >= startOfWarsawTodayIso(now)`, ascending, `limit(limit)`.
- Departures: `status = 'in_progress' AND planned_check_out >= startOfWarsawTodayIso(now)`, ascending, `limit(limit)`.
- Select only `id, last_name, passenger_count, flight_direction, planned_check_in, planned_check_out`.
- Merge by `planned_at` (tie: arrival first, then id) and take the first `limit`.
- Map `flight_direction` through `flightDirectionLabel`; set `overdue = planned_at < now`.
- Role-specific paths: driver `open_path = /kierowca?reservation=<id>`, `list_path = /kierowca`; staff `open_path = /rezerwacje/<id>`, `list_path = /`.

Response shape (shared contract for Kotlin and Swift):

```ts
type WidgetUpcomingItemDto = {
  id: string;
  kind: "arrival" | "departure";
  planned_at: string;          // ISO UTC
  last_name: string;
  passenger_count: number | null;
  flight_direction: string | null; // already a display label
  overdue: boolean;
  open_path: string;           // relative, role-specific
};
type WidgetUpcomingResponseDto = {
  generated_at: string;        // ISO UTC
  list_path: string;
  items: WidgetUpcomingItemDto[];
};
```

#### 4. Schemas and types

**File**: `src/lib/schemas/widget.schema.ts` (new), `src/types.ts`, `src/env.d.ts`

**Intent**: Zod at every widget boundary (per `lessons.md`); DTOs derived or re-exported from `src/types.ts`; `Locals.device?: { tokenId: string; userId: string; role: "staff" | "driver" }`.

**Contract**:
- `upcomingQuerySchema`: `limit` coerced int, 1–12, default 6.
- `registerDeviceSchema`: `installation_id` uuid, `platform` enum, `device_name` string ≤ 80, optional.
- `deviceIdParamSchema`: uuid.

#### 5. Middleware bearer branch + rate-limit key

**File**: `src/middleware/auth.ts`, `src/middleware/device-auth.ts` (new), `src/middleware/rate-limit.ts`

**Intent**: Implement the exact-path device branch described in Critical Implementation Details. An invalid or expired token returns 401 JSON `{ error: "invalid_token" }`, and a missing admin client returns 503. The rate limiter prefers `device:<tokenId>` as its key when `locals.device` is set.

**Contract**: `DEVICE_AUTH_ROUTES: ReadonlyArray<{ method: string; path: string }>` = `[{ GET, "/api/widget/upcoming" }]` (Phase 6 adds the push route). The paths aren't added to `PUBLIC_API_PREFIXES`.

#### 6. Routes

**File**: `src/pages/api/widget/upcoming.ts`, `src/pages/api/widget/devices/index.ts`, `src/pages/api/widget/devices/[id].ts` (new)

**Intent**: Thin handlers per `src/pages/api/AGENTS.md`.
- `GET upcoming`: accepts `locals.device` (or a cookie user as fallback) and responds with `Cache-Control: no-store`.
- `POST devices`: cookie user (driver or staff) registers the current installation; returns the token once.
- `GET devices`: staff only; lists all devices.
- `DELETE devices/[id]`: owner or staff.

**Contract**: `POST` → 201 `{ id, token, expires_at }`; `GET` → 200 `{ data: DeviceDto[] }`; `DELETE` → 204. Errors follow the existing `{ error }` JSON shape.

#### 7. Docs

**File**: `src/pages/api/AGENTS.md`

**Intent**: Add a "Widget APIs (device plane)" section covering the exact-path bearer rule, the `locals.device` vs `locals.user` separation, admin-client reads limited to `WidgetService`, and the tripwire "never add widget paths to `PUBLIC_API_PREFIXES`".

**Contract**: New section under "Driver APIs".

#### 8. Tests

**File**: `src/lib/services/device-token.service.test.ts`, `src/lib/services/widget.service.test.ts`, `src/middleware/auth.test.ts`, `src/pages/api/widget/*.test.ts` (new/extended)

**Intent**:
- **Token service**: hash-only storage; revoke-before-insert; expired, revoked, banned, and missing-user tokens are rejected (banned/missing also get auto-revoked); sliding expiry throttled.
- **Widget service**: exact filter values for a fixed `now` (including a DST date); merge order and ties; `limit` respected across kinds; overdue flag; role paths; column whitelist asserted on `select`.
- **Middleware**: a bearer on a non-device path is ignored (still 401 without a cookie); a bearer on the device path sets `locals.device` and never `locals.user`; a wrong method falls through.
- **Routes**: 401/403/400/201/204 matrix.

**Contract**: Reuse the chainable query mock from `reservation.service.test.ts:16-54`.

### Success Criteria:

#### Automated Verification:

- Migrations apply cleanly: `npx supabase db reset`
- Tests pass: `npm run test`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Locally, with a logged-in driver, `POST /api/widget/devices` from the browser console returns a `ptw_…` token; `curl -H "Authorization: Bearer <token>" /api/widget/upcoming` returns the expected mixed list, including tomorrow's items when run after 22:00
- The same bearer on `/api/driver/arrivals` returns 401
- Banning the user in Supabase Studio → the next widget call returns 401 and the row shows `revoked_reason = user_inactive`

**Implementation Note**: Pause for manual confirmation after automated checks pass.

---

## Phase 2: Deep Links and Device Management (Web)

### Overview

Make the widget's `open_path` targets actually open the right card, and give staff a device list with revoke in `/ustawienia`.

### Changes Required:

#### 1. Driver deep link

**File**: `src/components/driver/DriverOpsApp.tsx`, `src/hooks/useDriverOps.ts`

**Intent**: On mount, read `?reservation=<uuid>`. After the first successful fetch, look it up in the arrivals list (switch to the arrivals tab, set `arrivalTarget`) or the departures list (switch tab, set `departureTarget`). If it isn't found (already handled or not visible), show a toast "Rezerwacja już obsłużona lub niedostępna". Afterwards, `history.replaceState` removes the param so a refresh doesn't reopen it.

**Contract**: The `reservation` query param is validated as a uuid (ignore silently otherwise); consumed once per page load.

#### 2. Redirect preservation

**File**: `src/components/auth/login-form.tsx`, `src/middleware/auth.ts` (`isDriverHomePath`)

**Intent**: Compare the pathname of `redirectTo` so `/kierowca?reservation=…` survives login for drivers (see Critical Implementation Details).

**Contract**: The driver rule becomes pathname `=== "/kierowca" || startsWith("/kierowca/")`; the query string is preserved in the final `location.assign`.

#### 3. Device management UI

**File**: `src/components/settings/DevicesSection.tsx` (new), `src/pages/ustawienia.astro`, `src/hooks/useDevices.ts` (new)

**Intent**: A staff-only section listing devices: user email, platform, device name, created, last used, expires. It has a "Odwołaj" button per device and a "Odwołaj wszystkie" button per user, using `GET/DELETE /api/widget/devices`. It uses the existing Shadcn components (no edits to `src/components/ui/`).

**Contract**: `DELETE /api/widget/devices/[id]`. A per-user "revoke all" loops over that user's devices client-side, or uses an optional `?user_id=` on the collection DELETE. Pick one; the plan prefers the client loop, so there's no new endpoint.

#### 4. Tests

**File**: `src/components/driver/DriverOpsApp.test.tsx` (or the hook test), `src/components/auth/login-form.test.tsx`, E2E spec via `/10x-e2e`

**Intent**:
- **Unit**: param → dialog opens for arrival and departure; unknown id → toast; invalid uuid ignored; redirect pathname rule.
- **E2E**: a driver opens `/kierowca?reservation=<seeded id>`, sees the arrival dialog, and the URL param is gone after closing.

**Contract**: The E2E follows the CLAUDE.md rules (role/label locators, no `waitForTimeout`, self-seeded unique data).

### Success Criteria:

#### Automated Verification:

- Tests pass: `npm run test`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- E2E deep-link spec passes: `npm run test:e2e -- <spec>`

#### Manual Verification:

- A logged-out driver opening `/kierowca?reservation=<id>` lands, after login, on the open card
- A staff member sees their own and drivers' devices in `/ustawienia`, and revoking one makes that token return 401

**Implementation Note**: Pause for manual confirmation after automated checks pass.

---

## Phase 3: Android Shell (Capacitor)

### Overview

Create `apps/mobile` with Capacitor Android loading prod, a small native plugin that holds the device token, automatic device registration after login, deep-link handling, and a CI job that builds the APK.

### Changes Required:

#### 1. Mobile package scaffold

**File**: `apps/mobile/package.json`, `apps/mobile/capacitor.config.ts`, `apps/mobile/www/index.html`, `apps/mobile/android/**` (generated)

**Intent**: A standalone Capacitor project (latest stable major) with `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, and `@capacitor/app`.
- `server.url` defaults to prod and can be overridden by a `PARKTRACK_SERVER_URL` env at `cap sync` time, for preview/local builds.
- `server.allowNavigation` covers the same host only; cleartext only for local dev builds.
- `webDir` `www` holds an offline fallback page ("Brak połączenia — spróbuj ponownie").
- appId: `app.parktrack.mobile`.

**Contract**: `npx cap sync android` and `./gradlew assembleDebug` succeed from `apps/mobile`.

#### 2. Root isolation

**File**: `tsconfig.json`, `eslint.config.*`, `.prettierignore`, `vitest.config.*` (if its globs reach it), `nixpacks.toml`/`railway.toml` check

**Intent**: Keep the web toolchain and the Railway image blind to `apps/mobile`.

**Contract**: `tsconfig.json` `exclude` adds `apps/mobile`; ESLint `ignores` adds `apps/mobile/**`; Prettier ignores it; the Nixpacks build still runs only root `npm ci` + `npm run build` (verify `providers = ["node"]` still wins with Gradle files present).

#### 3. Native token plugin (Android)

**File**: `apps/mobile/android/app/src/main/java/app/parktrack/mobile/ParkTrackWidgetPlugin.kt` (new), `MainActivity.kt`

**Intent**: A Capacitor plugin exposing:
- `getInstallationId()`: a UUID generated once and persisted;
- `hasValidToken()`;
- `saveToken({ id, token, expiresAt, baseUrl })`;
- `clearToken()`;
- `refreshWidgets()`.

The token lives in EncryptedSharedPreferences (Jetpack Security) or a Keystore-backed DataStore. `MainActivity` handles `parktrack://open?path=…` intents (and widget PendingIntent extras) by validating the relative path and loading `server.url + path`.

**Contract**: The plugin is registered as `ParkTrackWidget`, available to the remote page via `window.Capacitor.Plugins.ParkTrackWidget`.

#### 4. Web-side native bridge

**File**: `src/lib/native/bridge.ts` (new), `src/components/native/NativeDeviceRegistration.tsx` (new), `src/layouts/Layout.astro`, `src/layouts/DriverLayout.astro`, logout flow (`src/pages/api/auth/*` caller / logout button component)

**Intent**: Detect the native runtime via the `window.Capacitor?.isNativePlatform?.()` global (no npm dependency). On authenticated pages, if the plugin reports no valid token, call `POST /api/widget/devices` with the installation id and pass the result to `saveToken`, then `refreshWidgets`. On logout, revoke the current device and `clearToken` before signing out. The island is a no-op in normal browsers.

**Contract**: `getNativeWidgetPlugin(): ParkTrackWidgetPlugin | null`; the island is rendered `client:idle` in both layouts. The stored device `id` is kept by the plugin so logout can `DELETE` it.

#### 5. Android CI

**File**: `.github/workflows/mobile-android.yml` (new)

**Intent**: On PRs touching `apps/mobile/**` or `src/lib/native/**`: setup-java 21, `npm ci` in `apps/mobile`, `npx cap sync android`, `./gradlew assembleDebug lint`, and upload the APK artifact. A manual `workflow_dispatch` release job builds a signed AAB using keystore secrets for Play internal testing.

**Contract**: The existing `ci.yml` stays unchanged.

### Success Criteria:

#### Automated Verification:

- Web tests/typecheck/lint/build still pass: `npm run test && npm run typecheck && npm run lint && npm run build`
- Android debug build passes locally: `cd apps/mobile && npx cap sync android && cd android && ./gradlew assembleDebug`
- `mobile-android` workflow is green on the PR

#### Manual Verification:

- APK installed on a physical phone: login works, and the session survives an app restart (cookies persisted)
- After login, `device_tokens` has a row for the phone; logging out revokes it
- `adb shell am start -d "parktrack://open?path=%2Fkierowca%3Freservation%3D<id>"` opens the card; a path like `//evil.com` is ignored
- The offline fallback shows with airplane mode on
- A Railway deploy of this branch builds and starts normally (no Gradle/Java detection)

**Implementation Note**: Pause for manual confirmation after automated checks pass.

---

## Phase 4: Android Widget

### Overview

A Glance home-screen widget that renders the upcoming list, refreshes periodically, caches the last payload, and deep-links on tap.

### Changes Required:

#### 1. Widget UI and receiver

**File**: `apps/mobile/android/app/src/main/java/app/parktrack/mobile/widget/UpcomingWidget.kt`, `UpcomingWidgetReceiver.kt`, `res/xml/upcoming_widget_info.xml`, `AndroidManifest.xml`

**Intent**: A responsive Glance widget with small (2–3 rows) and large (5–6 rows) layouts. Each row shows:
- the ↓/↑ icon;
- time formatted in `Europe/Warsaw`;
- surname (ellipsised);
- people count only when non-null;
- flight direction;
- overdue rows tinted.

The header "ParkTrack · zaktualizowano HH:mm" opens `list_path`, and each row opens its `open_path` via PendingIntent to `MainActivity`. States:
- **no token**: "Otwórz aplikację i zaloguj się";
- **401**: clear the token and show the same message;
- **empty**: "Brak nadchodzących przyjazdów i wyjazdów";
- **network error**: keep the cached list with a stale indicator.

**Contract**: Renders `WidgetUpcomingResponseDto` from Phase 1 exactly; requests `limit=6`.

#### 2. Data and scheduling

**File**: `.../widget/UpcomingRepository.kt`, `UpcomingRefreshWorker.kt`

**Intent**: Fetch with the bearer token and cache the JSON in DataStore. A WorkManager periodic worker runs every 15 min (the Android minimum) with a network constraint, plus an immediate one-off refresh on `refreshWidgets()`, on app resume, and on widget add.

**Contract**: One unique periodic work name (`upcoming-refresh`) with `KEEP` policy; the request timeout is 10 s.

### Success Criteria:

#### Automated Verification:

- `./gradlew assembleDebug lint testDebugUnitTest` passes (unit tests for JSON parsing, the path validator, and Warsaw time formatting)
- `mobile-android` workflow green

#### Manual Verification:

- Widget added on a physical phone shows the same items as `/kierowca` (plus tomorrow's late in the evening)
- Tapping a row opens the correct card; tapping the header opens the list
- After confirming an arrival in the app, the widget drops that item within 15 min (push arrives in Phase 6)
- Revoking the device in `/ustawienia` → the next refresh shows the "zaloguj się" state
- Airplane mode → the cached list stays, marked stale

**Implementation Note**: Pause for manual confirmation after automated checks pass. At this point the Android app can go to Play internal testing.

---

## Phase 5: iOS Shell and Widget

### Overview

Add the iOS platform, the Swift token plugin, a WidgetKit extension sharing the token through an App Group Keychain, and a GitHub Actions macOS workflow that builds and uploads to TestFlight.

### Changes Required:

#### 1. iOS platform + plugin

**File**: `apps/mobile/ios/**` (generated), `apps/mobile/ios/App/App/ParkTrackWidgetPlugin.swift` (new), `AppDelegate.swift`

**Intent**: Add `@capacitor/ios`. Implement the same `ParkTrackWidget` plugin contract as Android. Store the token in a Keychain item with access group `$(TeamID).app.parktrack.shared` and cache the payload in the App Group container `group.app.parktrack`. `refreshWidgets()` calls `WidgetCenter.shared.reloadAllTimelines()`. Handle `parktrack://open?path=` with the same relative-path validation.

**Contract**: The plugin API is identical to Android, so `src/lib/native/bridge.ts` stays platform-agnostic.

#### 2. Widget extension

**File**: `apps/mobile/ios/App/ParkTrackWidget/*.swift` (new), `apps/mobile/ios/scripts/add-widget-target.rb` (new)

**Intent**: A SwiftUI widget with `.systemSmall` and `.systemLarge` families and the same rows and states as Android. The `TimelineProvider` fetches with the Keychain token, falls back to the cached payload, and returns a timeline with policy `.after(now + 20 min)`. Rows use `Link(destination: parktrack://open?path=…)` (large) or `widgetURL` (small). The target is created by the idempotent xcodeproj script with a synchronized folder (see Critical Implementation Details).

**Contract**: Bundle id `app.parktrack.mobile.widget`; App Group and Keychain entitlements on both targets.

#### 3. iOS CI → TestFlight

**File**: `.github/workflows/mobile-ios.yml` (new), `apps/mobile/ios/fastlane/*` (optional)

**Intent**: On `workflow_dispatch` (and optionally PRs touching `apps/mobile/ios/**`): macOS runner, `npm ci`, `cap sync ios`, run the target script, build and sign with certificates and profiles from GitHub secrets (App Store Connect API key), and upload to TestFlight. PR builds run an unsigned simulator build only.

**Contract**: Secrets `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`, `IOS_DIST_CERT_P12`, `IOS_DIST_CERT_PASSWORD`, plus profiles (or fastlane match).

### Success Criteria:

#### Automated Verification:

- `mobile-ios` simulator build job green (`xcodebuild -scheme App -sdk iphonesimulator build`)
- `mobile-ios` release job uploads a build to TestFlight
- Web checks still pass: `npm run test && npm run typecheck && npm run lint`

#### Manual Verification:

- The TestFlight build on an iPhone: login persists across restarts, the device row is created, and logout revokes it
- The widget shows the correct list and states; row and header taps deep-link correctly
- Revoking the device → the widget shows the login state within one timeline refresh

**Implementation Note**: Pause for manual confirmation after automated checks pass. Prerequisites: Apple Developer account, App IDs, App Group, and App Store Connect API key created by the user.

---

## Phase 6: Silent Push on Status Change

### Overview

When a reservation becomes `in_progress` or `completed` through any path, enqueue an outbox row. The app drains it by sending a collapsed silent push to every device that has a push token, and the native side refreshes widgets on receipt.

### Changes Required:

#### 1. Outbox + trigger

**File**: `supabase/migrations/<ts>_add_widget_push_outbox.sql` (new)

**Intent**: A durable queue fed by the only true choke point. A `pg_cron` job deletes sent rows older than 7 days.

**Contract**: `widget_push_outbox(id bigserial pk, reservation_id uuid, new_status reservation_status, created_at, sent_at null, attempts int default 0, last_error text null)`, RLS on with no policies. Trigger:

```sql
create trigger trg_enqueue_widget_push
after update of status on public.reservations
for each row
when (old.status is distinct from new.status
      and new.status in ('in_progress', 'completed'))
execute function public.enqueue_widget_push();
```

#### 2. Push token registration

**File**: `src/pages/api/widget/devices/push.ts` (new), `src/middleware/auth.ts` (`DEVICE_AUTH_ROUTES`), `src/lib/schemas/widget.schema.ts`

**Intent**: The native app registers or updates its FCM/APNs token using its own device bearer. This is the second exact-path device route.

**Contract**: `PUT /api/widget/devices/push` with body `{ provider: "fcm" | "apns", token: string ≤ 4096 }` → 204. It updates only the calling device's row.

#### 3. Push sender

**File**: `src/lib/services/push.service.ts` (new), `src/lib/services/push/fcm.ts`, `src/lib/services/push/apns.ts` (new), `src/lib/services/driver.service.ts`, `src/lib/services/reservation.service.ts`, `src/env.d.ts`

**Intent**: `drainOutbox()` claims unsent rows (`attempts < 5`) and sends one collapsed silent push per active device with a push token:
- **FCM**: HTTP v1 data message with `collapse_key: "upcoming"`, using an OAuth access token from a service-account JWT signed with `node:crypto` RS256.
- **APNs**: HTTP/2 via `node:http2`, `content-available: 1`, `apns-push-type: background`, `apns-priority: 5`, `apns-collapse-id: upcoming`, with an ES256 provider JWT from the p8 key.

Then:
- mark rows as sent;
- on `UNREGISTERED` / 410, clear that device's `push_token`;
- on other errors, increment `attempts` and record `last_error`;
- when env keys are missing, mark rows sent with `last_error = 'push_not_configured'`.

Triggered fire-and-forget after `DriverService.applyUpdate` and `ReservationService.updateReservation` succeed, plus a lazily started 60 s `setInterval` sweep (`unref`) as the retry path.

**Contract**: Env vars (optional, server-only): `FCM_SERVICE_ACCOUNT_JSON`, `APNS_KEY_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_USE_SANDBOX`. At most one push per device per 30 s, coalesced within a drain.

#### 4. Native receivers

**File**: Android `apps/mobile/android/.../push/WidgetPushService.kt` + Firebase config (`google-services.json` injected from a CI secret); iOS `AppDelegate.swift` remote-notification handling + Push/Background Modes capabilities; `ParkTrackWidgetPlugin` gains token registration

**Intent**:
- **Android**: `FirebaseMessagingService.onMessageReceived` enqueues the one-off widget refresh; `onNewToken` calls `PUT /api/widget/devices/push`.
- **iOS**: register for remote notifications after a device token exists, send the APNs token, and on silent push call `reloadAllTimelines()`.

**Contract**: No user-visible notification is shown on either platform.

#### 5. Tests

**File**: `src/lib/services/push.service.test.ts`, `src/pages/api/widget/devices/push.test.ts`

**Intent**: Drain claims and marks rows; retry after failure; 410/UNREGISTERED clears the token; not-configured path; coalescing; the route updates only the caller's device; the migration trigger fires only on the listed transitions (SQL test via local db or a documented manual check).

### Success Criteria:

#### Automated Verification:

- Migrations apply cleanly: `npx supabase db reset`
- Tests pass: `npm run test`
- Type checking and lint pass: `npm run typecheck && npm run lint`
- Build passes: `npm run build`
- Android and iOS workflows green

#### Manual Verification:

- Two phones with widgets: confirming an arrival on one makes the item disappear from the other's widget within about 1 min (Android reliably, iOS best effort)
- A staff status change via `PATCH /api/reservations` also triggers the push
- With push env vars unset, status changes still succeed and outbox rows get `push_not_configured`
- After uninstalling the app on one phone, the next push clears that device's `push_token`

**Implementation Note**: Pause for manual confirmation after automated checks pass.

---

## Testing Strategy

### Unit Tests:

- `api-key.ts`: constant-time compare with length mismatch, missing secret.
- `device-token.service.ts`: generation format, hash-only storage, verify rejections (revoked, expired, banned, missing user), sliding expiry throttle, revoke-before-issue.
- `widget.service.ts`: Warsaw lower bound across DST, merge and tie order, limit across kinds, overdue flag, role paths, column whitelist, legacy flight direction mapping.
- `push.service.ts`: claim/mark/retry, token invalidation, coalescing, not-configured path.
- Native: JSON parsing, path validator, Warsaw time formatting (Android JVM tests; Swift logic kept in small pure functions).

### Integration Tests:

- Middleware: device branch isolation (bearer ignored on non-device paths; `locals.user` never set by a token; cookie fallback on `/api/widget/upcoming`).
- Routes: external (401/503/400/201), widget upcoming (401/200), devices (401/403/400/201/204), push registration (401/204).
- E2E: driver deep link opens the dialog and survives re-login.

### Manual Testing Steps:

1. Install the Android internal build, log in as a driver, and add the large widget; compare it with `/kierowca`.
2. At 22:30 Warsaw, check the widget shows tomorrow's morning items.
3. Tap an arrival row → the arrival dialog opens; confirm the arrival → the item leaves a second device's widget (Phase 6).
4. Ban the driver in Supabase → the widget shows the login state after the next refresh; `device_tokens` row revoked.
5. Repeat 1, 3, and 4 on a TestFlight iPhone.
6. Book through the public website → the reservation is created (API key in place).

## Performance Considerations

- The widget endpoint does two indexed-range queries (limit ≤ 12 each) plus a token lookup by unique hash. The `getUserById` check is cached 60 s, so the steady state is one Auth call per token per minute at most. With 15–30 min polling per device and a handful of devices, the load is negligible.
- Consider indexes `(status, planned_check_in)` / `(status, planned_check_out)` if they don't exist; check in the Phase 1 migration.
- The rate limit is keyed by token id, so widgets behind the same carrier NAT don't share an IP bucket.
- Push fan-out is O(devices) per drain, collapsed. Tens of devices max.

## Migration Notes

- Phase 0 drops two functions. If any external tool (for example Supabase SQL snippets) calls them, it breaks; research found no caller in `src/`.
- Deploy order in Phase 0: the website sends `X-API-Key` first, then set `API_SECRET_KEY` in Railway, then deploy the enforcement.
- Apply hosted migrations with the usual Supabase flow before deploying code that depends on them (see the memory note about migrations missing on Railway).
- Rollback: widget and device endpoints are additive. Revoking all rows in `device_tokens` disables every widget instantly. Dropping the push trigger stops push without affecting status writes.

## References

- Change decisions: `context/changes/embedeed-in-app/change.md`
- Research: `context/changes/embedeed-in-app/research.md`
- Driver list service: `src/lib/services/driver.service.ts:23-68,136-198`
- Warsaw helpers: `src/lib/driver/operating-window.ts:29-70`
- Auth middleware: `src/middleware/auth.ts:6,21-34,43,99-119`
- Admin client: `src/lib/supabase-admin.ts:10-32`
- External endpoint: `src/pages/api/reservations/external.ts:7-14`; prior API-key design `.ai/reservations-implementation-plan.md:77`
- Driver card state: `src/components/driver/DriverOpsApp.tsx:34-35,99-155`
- Login redirect: `src/components/auth/login-form.tsx:62-69`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 0: Security Hardening

#### Automated

- [ ] 0.1 Migrations apply cleanly on a fresh local DB: `npx supabase db reset`
- [x] 0.2 Unit/integration tests pass: `npm run test`
- [x] 0.3 Type checking passes: `npm run typecheck`
- [x] 0.4 Linting passes: `npm run lint`
- [x] 0.5 Build passes: `npm run build`
- [x] 0.6 No reference to `get_todays_` remains in `src/`

#### Manual

- [ ] 0.7 Public website sends `X-API-Key` before enforcement; real booking still works after deploy
- [ ] 0.8 `API_SECRET_KEY` set in Railway (prod + preview)
- [ ] 0.9 Anon call to `rpc/get_todays_arrivals` on hosted project returns function-not-found

### Phase 1: Device Tokens and Widget API

#### Automated

- [ ] 1.1 Migrations apply cleanly: `npx supabase db reset`
- [ ] 1.2 Tests pass: `npm run test`
- [ ] 1.3 Type checking passes: `npm run typecheck`
- [ ] 1.4 Linting passes: `npm run lint`
- [ ] 1.5 Build passes: `npm run build`

#### Manual

- [ ] 1.6 Registered token returns expected mixed list via curl (incl. tomorrow after 22:00)
- [ ] 1.7 Same bearer on `/api/driver/arrivals` returns 401
- [ ] 1.8 Banned user → 401 and row revoked with `user_inactive`

### Phase 2: Deep Links and Device Management (Web)

#### Automated

- [ ] 2.1 Tests pass: `npm run test`
- [ ] 2.2 Type checking passes: `npm run typecheck`
- [ ] 2.3 Linting passes: `npm run lint`
- [ ] 2.4 E2E deep-link spec passes

#### Manual

- [ ] 2.5 Logged-out driver deep link lands on open card after login
- [ ] 2.6 Staff sees and revokes devices in `/ustawienia`; revoked token returns 401

### Phase 3: Android Shell (Capacitor)

#### Automated

- [ ] 3.1 Web tests/typecheck/lint/build still pass
- [ ] 3.2 Android debug build passes locally
- [ ] 3.3 `mobile-android` workflow green

#### Manual

- [ ] 3.4 Login persists across app restarts on a physical phone
- [ ] 3.5 Device row created on login, revoked on logout
- [ ] 3.6 `parktrack://open` deep link opens card; absolute/`//` paths ignored
- [ ] 3.7 Offline fallback shows in airplane mode
- [ ] 3.8 Railway deploy of the branch builds and starts normally

### Phase 4: Android Widget

#### Automated

- [ ] 4.1 `./gradlew assembleDebug lint testDebugUnitTest` passes
- [ ] 4.2 `mobile-android` workflow green

#### Manual

- [ ] 4.3 Widget list matches `/kierowca` (plus tomorrow late evening)
- [ ] 4.4 Row and header taps deep-link correctly
- [ ] 4.5 Confirmed arrival drops from widget within 15 min
- [ ] 4.6 Revoked device → widget shows login state
- [ ] 4.7 Airplane mode → cached list shown as stale

### Phase 5: iOS Shell and Widget

#### Automated

- [ ] 5.1 `mobile-ios` simulator build job green
- [ ] 5.2 `mobile-ios` release job uploads to TestFlight
- [ ] 5.3 Web checks still pass

#### Manual

- [ ] 5.4 TestFlight app: login persists, device row created, logout revokes
- [ ] 5.5 iOS widget shows correct list/states; taps deep-link correctly
- [ ] 5.6 Revoked device → iOS widget shows login state within one refresh

### Phase 6: Silent Push on Status Change

#### Automated

- [ ] 6.1 Migrations apply cleanly: `npx supabase db reset`
- [ ] 6.2 Tests pass: `npm run test`
- [ ] 6.3 Type checking and lint pass
- [ ] 6.4 Build passes: `npm run build`
- [ ] 6.5 Android and iOS workflows green

#### Manual

- [ ] 6.6 Arrival confirmed on phone A disappears from phone B's widget within ~1 min
- [ ] 6.7 Staff PATCH status change also triggers push
- [ ] 6.8 Push env unset → writes succeed, outbox rows marked `push_not_configured`
- [ ] 6.9 Uninstalled app → next push clears that device's `push_token`
