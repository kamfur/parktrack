# Soniox PoC — voice reservations

Checks whether Soniox real-time (`stt-rt-v5`) recognizes Polish reservation dictation well enough before we build the feature. Change: `context/changes/voice-reservations/`.

It tests **STT only**. Turning the transcript into form fields (LLM) is a separate step. The question here: does the transcript contain the right plate, phone, surname and dates?

## Setup

1. Create an account at https://console.soniox.com. Create a project in the **EU** region and an API key in it. Sign the DPA in the console.
2. Add to `.env`:
   ```
   SONIOX_API_KEY=...
   SONIOX_REGION=eu   # or "global" if the key belongs to a non-EU project
   ```

Node 22+ is required (global `WebSocket`, `process.loadEnvFile`). No npm dependencies.

## 1. Record (about 15 minutes)

```bash
node scripts/soniox-poc/record-server.mjs
```

Open http://localhost:5178 and record all 15 scenarios. Read the text **the way you would during a real call**: natural pace, normal mic, normal room. `s12` must be recorded with background noise. Files go to `recordings/<id>.wav` (gitignored).

Optional, phone/driver conditions: record on the phone (dictaphone app) in the car or on the lot, then convert and drop the file into `recordings/` with the scenario id:

```bash
ffmpeg -i nagranie.m4a -ac 1 -ar 16000 scripts/soniox-poc/recordings/s04-phone-digits.wav
```

Best signal: ask a second person (a driver, another staff member) to record too, then compare the two voices.

## 2. Run

```bash
node scripts/soniox-poc/run.mjs
```

- By default, each recording runs twice: `plain` (no hints) and `context` (domain hints + terms, see `SONIOX_CONTEXT` in `lib.mjs`).
- WAV files are streamed **at real-time pace** (100 ms chunks), so latency matches a live mic. 15 recordings × 2 runs take about 10–15 minutes. `--fast` skips pacing (no latency numbers).
- `--only=s01-basic,s03-correction`, `--mode=context|plain|both`.
- Cost of a full run is a few cents (~$0.12/h of audio).

The report goes to `results/<timestamp>.md` (+ `.json`), gitignored.

## Metrics

| Metric | Meaning |
|---|---|
| WER | Word error rate vs the script, after normalization: number words → digits, spelled letters → letters, fillers dropped. Paraphrasing while recording raises WER, so treat it as a rough signal. |
| Entities strict | Entity (plate, phone, surname, date, …) found in the normalized transcript, diacritics included. |
| Entities loose | The same, but ignoring Polish diacritics. A gap between strict and loose means a diacritics problem (fixable by LLM or a surname dictionary). |
| Partial latency p50 | How long after speaking the live (non-final) text appears. This is what the user sees while filling the form. |
| Final latency p95 | How long until text becomes final, including endpoint detection after a pause. |
| Low confidence | Tokens with confidence < 0.7. Candidates for highlighting in the UI. |

## Go / no-go (proposal)

| Criterion | Go | Rethink |
|---|---|---|
| Plate, strict | ≥ 90% | < 80% → spelling mode or OCR fallback |
| Phone, strict | ≥ 90% | < 80% |
| Surname, loose | ≥ 90% | < 80% |
| Date, strict | ≥ 95% | < 90% |
| Partial latency p50 | < 700 ms | > 1500 ms |
| `context` vs `plain` | — | If `context` gives no gain, drop it (simpler token endpoint) |

The normalizer in `lib.mjs` is intentionally simple. If an entity is "missed" but the transcript looks right in the report, the problem is normalization, not Soniox. Take that as a hint for what the LLM extraction step must handle.
