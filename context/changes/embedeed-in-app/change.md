---
change_id: embedeed-in-app
title: Mobile app (Android + iOS) with upcoming arrivals/departures widgets
status: implementing
created: 2026-09-25
updated: 2026-09-25
archived_at: null
---

## Notes

Decisions from grilling session (2026-09-25):

- **Users:** driver + staff; both see the same list (existing "nearest" arrivals/departures RPCs). No shift/assignment scoping in v1.
- **App shape:** Capacitor wrapper around existing Astro/React views; native code only for widgets (Android Glance/Kotlin, iOS WidgetKit/Swift).
- **Widget content:** single chronological list (↓ arrival / ↑ departure), nearest N items (small 2–3, large 5–6). Fields: time, surname, number of people, flight direction.
- **Tap:** deep link to reservation card (driver → driver module card, staff → reservation details); header → today's list.
- **Freshness:** timeline + periodic refresh ~15–30 min; silent push only on status change (arrived / departed) to avoid double pickups.
- **Auth:** dedicated read-only device token for `/api/widget/upcoming`, stored in Keychain/App Group (iOS) and EncryptedSharedPreferences (Android); revocable per device, invalid when account deactivated.
- **Distribution:** internal only — Play internal/closed testing; TestFlight → Unlisted/Custom App.
- **iOS build:** cloud macOS CI (GitHub Actions / Codemagic) — no local Mac.
- **Phasing:** 1) Android (Capacitor + endpoint + token + widget), 2) iOS widget on proven API, 3) push.

Accepted risks:

- Surnames visible on lock screen (GDPR) — consider "hide on lock screen" option later.
- New/cancelled reservations reach widget with up to ~30 min delay (no push for these).
- iOS widget UI iteration is slow without a Mac (each change = CI build + TestFlight).
- New costs: Apple Developer $99/yr, Google Play $25 one-off; FCM/APNs maintenance.
