---
change_id: voice-reservations
title: Voice reservations — live voice-assisted reservation form filling during a phone call
status: implementing
created: 2026-09-30
updated: 2026-10-01
archived_at: null
---

## Notes

Decisions from grilling session (2026-09-30):

- **Scenario:** staff member talks to the customer on a regular phone. ParkTrack in the browser listens to the microphone and fills the reservation form live. The staff member reviews and saves. No AI voice bot, no call recording, no telephony/VoIP integration.
- **Audio source:** the phone is held to the ear, so the laptop/tablet mic hears **only the staff member**. They repeat the data aloud ("so 12 October, Kowalski, WA 12345…"). The customer's voice is not captured.
- **Language:** Polish only.
- **Volume:** 20–80 phone reservations per day in peak season (~1500–2500 per month).
- **Users:** staff (desktop — `NewReservationModal` / `FullReservationForm`) **and** drivers (mobile — `DriverNewReservationDialog`).
- **Assistant scope:**
  - fills form fields (surname, first name, dates and times, license plate, phone, parking type, flight direction (passenger count dropped: no form field)),
  - shows the price live (via existing `/api/calculate-cost`),
  - checks availability (via existing `/api/availability`).
  - Out of scope for now: recognizing returning customers.
- **Price and availability are deterministic:** the extractor only fills fields. It never computes price or availability; the form calls the existing endpoints when dates or parking type change.
- **UX:** start/stop mic button + live filling. Fields filled by voice are highlighted. A field edited by hand is locked from voice overwrite (manual edit wins). The human always confirms and saves.
- **Budget:** up to ~50 PLN/month for AI services.
- **GDPR:** user asked for a recommendation → EU-only processing (see `research.md`). No audio storage.

Recommended stack (details and cost breakdown in `research.md`):

- STT: **Soniox v5 real-time**, EU endpoint, temporary API key per session issued by an Astro endpoint, WebSocket directly from the browser.
- ~~LLM extraction (Gemini 2.5 Flash-Lite)~~ → **superseded in planning (2026-10-01): deterministic TypeScript parser, no LLM.** The PoC showed Soniox already normalizes numbers, dates and plates. That means 0 PLN, a single processor (Soniox) and testable rules.
- Estimated total: Soniox only, ~30–55 PLN/month worst case.

Next step: 1-evening PoC. It is ready in `scripts/soniox-poc/` (15 dictation scenarios, local recorder, real-time runner measuring WER, entity hit rate and latency, plus go/no-go thresholds in its README). Done 2026-10-01; results are in `research.md` → "PoC results". Plan: `plan.md` / `plan-brief.md`.

- OpenRouter does not offer Soniox. Its STT endpoint is file upload only, with no streaming, so it does not fit live filling. Use Soniox directly for STT. OpenRouter stays an option for the LLM extraction step (but it adds a US intermediary for GDPR).

Accepted risks:

- License plates and surnames spelled aloud may be misrecognized. Mitigation: context hints, parser normalization (phone group repair, plate format warning), mandatory plate confirmation before save.
- Mobile: screen lock kills the mic, and iOS Safari needs a user gesture. Mitigation: Wake Lock and an explicit button.
- Worst-case STT cost can slightly exceed the budget if the mic stays open for the whole call without VAD.
