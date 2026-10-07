---
date: 2026-09-30T12:00:00+02:00
researcher: Claude (Opus 5.5) for kamfur
git_commit: 9be95f5c396200bf1a12e063f03b2dee1907889f
branch: feat/driver-module
repository: parktrack
topic: "Voice reservations — feasibility, architecture and cost of live voice-assisted reservation entry"
tags: [research, external, voice, stt, llm, reservations, driver, gdpr, costs]
status: complete
last_updated: 2026-09-30
last_updated_by: Claude (Opus 5.5)
---

# Research: Voice reservations — feasibility, architecture and cost

**Date**: 2026-09-30 (Europe/Warsaw)
**Researcher**: Claude (Opus 5.5) for kamfur
**Git Commit**: 9be95f5 (working tree has large uncommitted changes)
**Branch**: feat/driver-module
**Repository**: parktrack

## Research Question

Can staff add reservations by voice during a phone call with a customer? What is the best way to do it, and what would it cost?

Requirements come from the grilling session; see `change.md`.

## Summary

**Feasible and within the ~50 PLN/month budget.** The chosen scenario is the technically easiest one. The mic hears one clean Polish speaker (the staff member repeating the data). There is no telephony integration, no customer recording, and no browser access to GSM audio needed.

## Codebase facts relevant to the design

- `reservations` required fields: `last_name`, `planned_check_in`, `planned_check_out`, `parking_type`. Optional fields the voice flow can fill: `first_name`, `phone`, `email`, `license_plate`, `passenger_count`, `flight_direction`, `notes`.
- Validation lives in `src/lib/schemas/reservation.schema.ts` (`createReservationSchema`, used by `src/pages/api/reservations.ts:213`).
- Existing endpoints to reuse: `src/pages/api/calculate-cost.ts`, `src/pages/api/availability.ts`.
- Forms to integrate: `src/components/reservations/NewReservationModal.tsx` / `FullReservationForm.tsx` (staff) and `src/components/driver/DriverNewReservationDialog.tsx` (drivers). Hook: `src/hooks/useCreateReservation.ts`.
- No speech/LLM integration exists in the app. `OPENROUTER_API_KEY` exists only for the dev code-reviewer package.

## Recommended architecture

```
Mic (browser) ──WebSocket──► Soniox real-time (EU endpoint)
      ▲                                │ live transcript
      │ temporary key                  ▼
/api/voice/token (Astro)     /api/voice/extract (Astro + Zod)
                                       │ LLM: new segment + current form state → JSON
                                       ▼
                       reservation form (highlighted fields)
                                       │ dates / parking type changed
                                       ▼
                 existing /api/calculate-cost and /api/availability
```

1. **STT directly from the browser.** An Astro endpoint issues a Soniox temporary API key (single session, short TTL). The main key never reaches the client, and audio does not pass through Railway.
2. **LLM extraction** runs on each finalized transcript segment. Input: the new text plus the current form state, today's date and the `Europe/Warsaw` timezone, which are needed for "next Friday at six in the morning". Output: structured JSON parsed by Zod (a partial of `createReservationSchema`).
3. **Price and availability stay deterministic.** The form calls the existing endpoints when dates or parking type change, exactly as it does today. The LLM cannot get the price wrong because it never computes it.
4. **Human confirms.** Voice-filled fields are highlighted. A manually edited field is locked from voice overwrite. Saving stays a manual action.
5. One shared `VoiceCapture` component plus a `useVoiceReservation` hook, used in both the staff and driver forms.

## Cost analysis

Assumptions: ~2500 calls/month, mic open ~3 min per call → ~125 h of audio/month. 1 USD ≈ 3.65 PLN.

### Speech-to-text (streaming)

| Provider | Price | Monthly | Notes |
|---|---|---|---|
| **Soniox v5 RT** ✅ | ~$0.12/h | **~40–55 PLN** | Best Polish WER in vendor's own benchmark (1.25%). EU data residency, self-serve DPA, temporary keys for browsers. |
| Deepgram Nova-3 | $0.0048/min | ~105–130 PLN | EU endpoint (`api.eu.deepgram.com`), over budget. |
| ElevenLabs Scribe v2 RT | $0.39/h | ~180 PLN | Over budget. |
| OpenAI Realtime / Live Transcribe | $0.017/min | >450 PLN | Over budget. |
| Web Speech API (Chrome) | free | 0 PLN | Fallback only. Cloud mode sends audio to Google with no DPA. On-device mode (`processLocally`) is new and Polish support is unconfirmed. Weak on iOS. |

### LLM extraction

~6 calls per conversation, ~20M input + ~2M output tokens/month.

| Model | Price (in/out per 1M tokens) | Monthly |
|---|---|---|
| **Gemini 2.5 Flash-Lite** ✅ | $0.10 / $0.40 | **~10–15 PLN** |
| Claude Haiku 4.5 (with prompt caching) | $1.00 / $5.00 | ~70–120 PLN. Over budget unless extraction runs rarely, e.g. only on stop. |

### Total

**~30–70 PLN/month** worst case. It drops under 50 PLN with client-side VAD (don't stream silence while the customer talks). Fixed cost: 0 PLN, since there are no subscriptions.

## GDPR

Recommendation: **EU-only processing.** It costs nothing extra at this budget.

- Soniox: EU region (`stt-rt.eu.soniox.com`), self-serve DPA.
- Gemini via Vertex AI in an EU region. Avoid OpenRouter for production data, because it adds a US intermediary.
- No audio storage. Keeping the transcript is optional and short-lived.
- The customer is not recorded, but the staff member speaks the customer's personal data aloud. Add the processor to the privacy policy and inform staff.

## Risks

1. **License plates and surnames** spelled aloud ("WA one two three X"). Mitigation: Soniox context hints, LLM normalization, mandatory highlight and review.
2. **Relative dates and times.** Pass today's date to the LLM. Validate that check-out is after check-in.
3. **Mobile.** Screen lock drops the mic, and iOS Safari needs a user gesture. Use the Wake Lock API and an explicit button.
4. **Voice vs manual edit race.** The manual edit always wins.

## Effort estimate (after-hours)

- **PoC: 1 evening.** Record 10–15 dictations and measure plate and date accuracy in the Soniox playground. This is the main risk, so validate it first.
- **MVP: ~6–9 evenings.** Covers the token endpoint, the extract endpoint with Zod, the hook and component, integration into both forms, unit tests for date and plate normalization, and one E2E test with a mocked STT.

## PoC results (2026-10-01)

Ran `scripts/soniox-poc` on 15 recorded dictations (one speaker, laptop mic), `stt-rt-v5`. The run used the global endpoint because the PoC key belongs to a global project. Production needs an EU project key.

| Metric (`context` mode) | Result |
|---|---|
| Surname (loose) | 14/15 (93%) |
| Date | 25/27 (93%). Both misses come from one slurred recording (s15). |
| License plate | **11/15 (73%)**. This is the weak spot. |
| Phone | 3/4. The miss was the noisy recording: `512 300 45 678`. |
| Parking type / flight / email / passengers | 4/4, 5/5, 1/1, 4/4 |
| Partial (live) latency p50 | 667 ms |
| Final latency p50 / p95 | **~4.9 s / ~6.4 s**. Continuous reading with no pauses, so automatic endpoint detection finalized late. |
| Cost | $0.0077 for 3.9 min (matches ~$0.12/h) |

Findings that shape the design:

1. **Soniox does its own inverse text normalization**: `604 123 987`, `KR 7HX29`, `22:00`, `04:40`. The LLM gets near-structured text. Raw WER (~37%) is inflated by the PoC normalizer, not by recognition errors.
2. **The `context` hints help**: phone grouping (790 vs 700 90), "wiata" recognized, compact plates. Keep them.
3. **Plate errors** have two patterns. Repeated digits collapse ("zero zero siedem" → `07`, "dwa dwa dwa" → `22`), usually with low confidence. Occasional substitutions or swaps happen at high confidence (`SI`→`SK`, `7142`→`7124`). So the plate needs dedicated UI verification (prominent display, low-confidence highlight, easy manual fix). Confidence alone is not enough.
4. **Final latency** must be driven manually: client VAD detects ~200 ms of silence, then the client sends `{"type":"finalize"}`, and Soniox returns finals followed by a `<fin>` token. Partial tokens (~0.7 s) can drive a live preview.
5. **The LLM extraction step must re-join split number groups** (`512 300 45 678` → `512 345 678`) and validate phone length (9 digits).
6. Surname errors (Grzegorczyk → Gregorczyk) came with low token confidence, which makes it a usable highlight signal.

## Sources

- [Deepgram pricing (smallest.ai)](https://smallest.ai/blog/deepgram-pricing-plans-cost-what-you-get-in-2026), [Deepgram EU endpoint](https://deepgram.com/learn/deepgram-eu-endpoint-now-generally-available)
- [OpenAI transcription pricing (costgoat)](https://costgoat.com/pricing/openai-transcription), [GPT-Realtime-Whisper](https://developers.openai.com/api/docs/models/gpt-realtime-whisper.md)
- [ElevenLabs realtime STT](https://elevenlabs.io/realtime-speech-to-text), [ElevenLabs API pricing](https://elevenlabs.io/pricing/api)
- [Soniox vs OpenAI – Polish](https://soniox.com/compare-stt/soniox-vs-openai/polish), [Soniox data residency](https://soniox.com/docs/stt/data-residency), [Soniox API reference](https://soniox.com/docs/stt/api-reference)
- [Gemini API pricing (morphllm)](https://www.morphllm.com/gemini-api-pricing), [Gemini 2.5 Flash-Lite pricing](https://anotherwrapper.com/llm-pricing/gemini-2.5-flash-lite)
- [Claude Haiku 4.5 pricing](https://pricepertoken.com/pricing-page/model/anthropic-claude-haiku-4.5)
- [MDN: SpeechRecognition.processLocally](https://developer.mozilla.org/docs/Web/API/SpeechRecognition/processLocally), [Intent to Ship: On-device Web Speech API](https://groups.google.com/a/chromium.org/g/blink-dev/c/VNOok2dbmHM/m/TQpe9shjCgAJ)
