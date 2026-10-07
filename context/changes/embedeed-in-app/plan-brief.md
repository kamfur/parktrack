# Mobile App + Upcoming Widgets — Plan Brief

> Full plan: `context/changes/embedeed-in-app/plan.md`
> Research: `context/changes/embedeed-in-app/research.md`

## What & Why

Drivers and staff should see the nearest arrivals and departures at a glance on their phone's home screen, without opening the app. The widget shows time, surname, people count and flight direction; a tap goes straight to the reservation card. We ship ParkTrack as an internal Android and iOS app (a Capacitor shell over the web app) with native widgets.

## Starting Point

The web app (Astro SSR + Supabase on Railway) already has mobile-friendly driver views, but auth is cookie-only. Every list stops at Warsaw midnight. The driver card has no URL, and there's no native, PWA or push code. Research also found two live security holes: PII-leaking `SECURITY DEFINER` RPCs callable with the anon key, and an unauthenticated external reservation endpoint.

## Desired End State

An internal build on Android (Play internal) and iOS (TestFlight). After one login, a widget shows a mixed, time-sorted list of the next items (overdue ones highlighted, tomorrow's included late at night). Taps deep-link to the right card for the user's role. The widget refreshes every 15–30 min, plus a silent push when anyone marks a reservation arrived or departed. Staff can revoke devices; banned users lose access automatically. Both security holes are closed.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Users | Driver + staff, same list | One endpoint; no shift/assignment scoping needed in v1 | Grilling |
| App shape | Capacitor wrapper loading prod `server.url` | App is SSR with cookie auth; reuse all web UI | Grilling / Research |
| Widget fields | Time, surname, people (hidden if null), flight direction | Enough to pick a car; surname keeps small widget readable | Grilling / Plan |
| Window | From start of Warsaw day, no upper bound | Keeps today's overdue visible; fixes empty-after-midnight gap | Plan |
| Auth | Read-only per-device token (`ptw_`, sha256-stored), exact-path bearer branch, `locals.device` only | Widget has no cookies; separate plane fails closed | Grilling / Research |
| Token lifetime | 90 d sliding on use | No surprise logouts; abandoned phones expire | Plan |
| Deactivation | Honour Supabase ban/delete on verify + staff device list/revoke | Covers requirement without building account management | Plan |
| Security holes | Fixed first (Phase 0) | Mobile client must not launch on a leaky backend | Plan |
| Repo layout | `apps/mobile/` with own `package.json` | Railway/Nixpacks root build and server image unchanged | Plan |
| Web ↔ native | `window.Capacitor` global, no root `@capacitor/*` dep | Remote page gets the bridge injected | Plan |
| Freshness | 15–30 min periodic + silent push on arrived/departed only | Avoid double pickups; accepted delay for new/cancelled | Grilling |
| Push path | DB trigger → outbox → app-side FCM/APNs sender with retry | Catches staff PATCH bypass; durable on send errors | Plan |
| Distribution / iOS build | Internal only; GitHub Actions macOS → TestFlight | No Mac available | Grilling |
| Order | Android → iOS → push | Full iteration loop on Windows first | Grilling |

## Scope

**In scope:** security fixes; `device_tokens` + widget/devices API; `/kierowca?reservation=` deep link + redirect fix; staff device list in `/ustawienia`; Android shell + Glance widget + CI; iOS shell + WidgetKit + TestFlight CI; outbox-based silent push.

**Out of scope:** native UI rewrite, offline mode, public store listing, shift/assignment scoping, in-app account deactivation, expected passenger count on bookings, Live Activities, push for new/cancelled reservations, KTW hours in widget.

## Architecture / Approach

The native widget calls `GET /api/widget/upcoming` with `Authorization: Bearer ptw_…`. `authMiddleware` accepts the bearer only on exact device paths and sets `locals.device`. `WidgetService` then runs two admin-client queries with whitelisted columns, merges them, and returns a DTO with server-computed `open_path`, flight-direction label and overdue flag. The widget renders it and opens `parktrack://open?path=…`, and the shell loads `server.url + path` after same-origin validation. The WebView registers the device after login through the native plugin, which stores the token in Keychain/App Group or EncryptedSharedPreferences. When a status changes, a trigger writes to the outbox, `PushService` sends collapsed silent FCM/APNs pushes, and the widget reloads.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 0. Security hardening | Dead RPCs dropped; external API key + Zod | Breaking the public website booking if deploy order is wrong |
| 1. Device tokens + widget API | Table, bearer branch, devices + upcoming endpoints | Admin-client read bypasses RLS: must stay tiny and whitelisted |
| 2. Deep links + device mgmt | `/kierowca?reservation=`, redirect fix, `/ustawienia` devices | Redirect pathname check regressions |
| 3. Android shell | `apps/mobile`, plugin, registration, CI | Cookie persistence in WebView; Nixpacks detection |
| 4. Android widget | Glance widget, WorkManager refresh, states | OEM battery savers delaying refresh |
| 5. iOS | Plugin, WidgetKit, App Group, TestFlight CI | Xcode target setup and signing without a Mac |
| 6. Push | Outbox trigger, sender, native receivers | iOS silent-push throttling (best effort) |

**Prerequisites:** Apple Developer ($99/yr) + Google Play ($25) accounts; App Store Connect API key; Firebase project; access to update the parking website (`X-API-Key`); physical Android phone and iPhone for manual tests.
**Estimated effort:** ~8–10 sessions (Phase 0–2: 3, Phase 3–4: 2–3, Phase 5: 2, Phase 6: 1–2).

## Open Risks & Assumptions

- Surnames are visible on the lock screen (accepted; a hide option may be added later).
- New or cancelled reservations reach the widget with up to ~15–30 min delay (no push for these).
- iOS widget UI iteration is slow without a Mac (each change is a CI build).
- Assumes Capacitor's injected bridge works on the remote `server.url` page and WebView cookies persist; verified in Phase 3 before building widgets.
- The public website must be updated in lockstep with Phase 0.

## Success Criteria (Summary)

- A driver adds the widget once and sees the correct upcoming items, including tomorrow's late at night, without opening the app.
- A tap lands on the right reservation card; an arrival confirmed on one phone disappears from other phones' widgets within about a minute.
- Revoked devices and banned users lose widget access; the anon key and the external endpoint no longer leak or accept data.
