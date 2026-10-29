# Voice Reservations — Plan Brief

> Full plan: `context/changes/voice-reservations/plan.md`
> Research: `context/changes/voice-reservations/research.md`

## What & Why

Staff take 20-80 phone reservations a day and type them in while talking. With this change, the staff member repeats the customer's data aloud and the reservation form fills itself live. Drivers get the same flow on mobile. The goal is faster, less error-prone phone booking within ~50 PLN/month.

## Starting Point

There are two create forms. The staff `NewReservationModal` (quick/full modes, react-hook-form + Zod, `Date` values) and the driver `DriverNewReservationDialog` (react-hook-form without a resolver, `datetime-local` strings) both have live price, and staff also has availability gating. A Soniox PoC on 15 Polish dictations showed good recognition of names, dates and phones. License plates are the weak spot (73%), and final-text latency was ~5 s because of default endpointing.

## Desired End State

Both forms have a "Dyktuj" button. While the staff member speaks, a transcript preview scrolls and fields fill within ~1.5 s of each pause. Fields filled by voice are marked, and low-confidence ones are flagged. Corrections replace earlier values, and anything typed by hand is never overwritten. A voice-filled plate must be confirmed before saving. Nothing is stored beyond the reservation itself.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scenario | Staff repeats data aloud; mic hears only staff | Clean single voice, no telephony or customer recording | Research |
| STT | Soniox `stt-rt-v5` via `@soniox/client`, EU region, temp key from backend | Best Polish accuracy and cheapest streaming (~$0.12/h); SDK has region, finalize, reconnect | Research |
| Field extraction | Deterministic TS parser, **no LLM** | Soniox already outputs `12 października` / `604 123 987` / `KR 7HX29`; 0 PLN, one processor, testable | Plan |
| Latency fix | `max_endpoint_delay_ms: 500` (default 2000) | Explains the PoC's ~5 s finals; config-only fix | Plan |
| Staff entry | Mic in modal; quick mode auto-switches to full | Plate, phone and type exist only in full; quick stays default | Plan |
| Plate safety | Mandatory "Potwierdź rejestrację" + format warning | 2 of 4 PoC plate errors had high confidence | Plan |
| Overwrite rule | Provenance `empty/voice/manual`; manual always wins | Prevents voice from clobbering staff edits | Research |
| Transcript | Live preview only, never stored | Explains fields to staff; simplest GDPR | Plan |
| Price/availability | Existing endpoints and hooks, unchanged | Deterministic money logic stays in one place | Research |
| Tests | Parser corpus from PoC + API tests + 1 E2E with fake source | Deterministic, free in CI, covers the full flow | Plan |

## Scope

**In scope:**
- Transcript parser (names, phone with group repair, email, plate, dates and times with roles and corrections, parking type, flight direction) and merge logic
- `POST /api/voice/token` (Soniox temp key)
- `TranscriptSource` abstraction (Soniox and fake), `useVoiceSession`, shared mic and preview UI
- Staff and driver form integration, plate confirmation
- One E2E test

**Out of scope:**
- LLM
- Transcript or audio storage
- Passenger count (no form field)
- Returning-customer lookup
- Complex relative dates ("za tydzień w środę")
- Edit forms and walk-ins
- Telephony

## Architecture / Approach

```
Mic ──@soniox/client (region eu)──► Soniox RT ──tokens──► useVoiceSession
          ▲ temp key                                        │ re-parse full final transcript
  POST /api/voice/token (Astro)                             ▼
                                         parseReservationTranscript → planVoiceUpdates (provenance)
                                                            ▼
                                  form.setValue → existing price / availability hooks
```

The parser is pure and always re-parses the whole final transcript ("last mention wins"). Partial text is only previewed. E2E swaps the Soniox source for a fake behind `PUBLIC_VOICE_FAKE`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Parser + merge | Pure `src/lib/voice/` with PoC corpus tests | Polish phrasing variety beyond the corpus |
| 2. Token endpoint | `/api/voice/token` + Soniox adapter | EU project key/region mismatch (401 seen in PoC) |
| 3. Capture module | SDK wrapper, fake source, hook, mic/preview UI | Latency not meeting ~1.5 s with endpoint tuning |
| 4. Staff form | Live fill, highlights, plate confirm in modal | Provenance vs `onChange` transforms interplay |
| 5. Driver form | Same flow on mobile dialog | Screen lock / reconnect on phones |
| 6. E2E | Staff flow test with fake transcript | Hydration timing in the modal |

**Prerequisites:**
- A Soniox project in the **EU** region with a signed DPA, plus its key in `.env`. The PoC key is global and returns 401 on EU.
- `PUBLIC_VOICE_ENABLED=true` for local testing.

**Estimated effort:** ~6-9 evenings across 6 phases. Phase 1 is the largest.

## Open Risks & Assumptions

- The parser is tuned to one speaker's PoC phrasing. Other staff may phrase things differently, so plan to extend rules after the first week of real use.
- The plate error rate (~27% in the PoC) relies on the confirmation step. If staff click "Potwierdź" without looking, errors pass through.
- The latency fix (`max_endpoint_delay_ms: 500`) is unverified until Phase 3 manual testing. The fallback is a manual `finalize()` after detected silence.
- Customers with non-Polish names (e.g. "Minh" → "Michn") will need manual correction.

## Success Criteria (Summary)

- A staff member can complete a phone reservation by dictating it. Only the plate confirmation (and any flagged field) needs a click.
- Fields appear within ~1.5 s of a pause, and manual edits are never overwritten.
- AI cost stays under ~50 PLN/month (Soniox only).
