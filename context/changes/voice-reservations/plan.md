# Voice Reservations Implementation Plan

## Overview

Staff (desktop) and drivers (mobile) get a microphone button in the reservation create forms. While on the phone, the staff member repeats the customer's data aloud. Soniox real-time STT transcribes it in the browser, and a deterministic TypeScript parser turns the transcript into form fields. The form fills live: voice-filled fields are highlighted, a manually edited field is never overwritten by voice, and a voice-filled license plate must be confirmed before saving. Price and availability keep coming from the existing endpoints. There is no LLM: Soniox already normalizes numbers, dates and plates (`12 października`, `604 123 987`, `KR 7HX29`), so rules are enough. Customer data reaches a single external processor (Soniox).

## Current State Analysis

- **Staff form.** `NewReservationModal` holds `mode: "quick" | "full"`, with quick as the default (`src/components/reservations/NewReservationModal.tsx:19-20`). Switching to full carries over only lastName and the two dates (lines 97-116). `FullReservationForm` uses react-hook-form + `zodResolver(fullReservationSchema)` (`src/components/reservations/FullReservationForm.tsx:36-52`). Fields are shadcn `FormField`s controlled through `field.onChange`, and no `setValue` is used anywhere. `onChange` also transforms input: names are capitalized (lines 118-120, 141-143), the phone is formatted `xxx xxx xxx` (lines 63-69), and the plate is uppercased (line 259). Dates are JS `Date` values from `DateTimePicker` in browser-local time, defaulting to today and tomorrow at 00:00 (lines 31-34). `source: "phone"` is hardcoded (`NewReservationModal.tsx:35, 58`).
- **Staff price and availability.** Price comes from `useCostCalculation`, which fires on every change with no debounce (`src/hooks/useCostCalculation.ts:75`). Availability comes from `useAvailabilityCheck` (500 ms debounce) and gates submit (`FullReservationForm.tsx:55, 397`).
- **Driver form.** `DriverNewReservationDialog` uses react-hook-form **without a resolver**. Values are a local `FormValues` interface of strings (lines 28-40), and dates are `datetime-local` strings (lines 173, 185) converted with `src/lib/schemas/driver-form.schema.ts:26-39`. Validation is `driverCreateReservationSchema.safeParse` on submit (lines 77-94). The driver form has no email and no availability check. Price comes from `useNewStayQuote` (300 ms debounce with abort, `src/hooks/useCheckoutQuote.ts:14-75`).
- **Schemas.** `fullReservationSchema` (`src/lib/schemas/reservation.schema.ts:178-237`):
  - `lastName` has a letters-only regex and min length 2.
  - `phone` must have 0 or 9 digits.
  - `licensePlate` is max 15 characters.
  - `parkingType` is `open_air | carport | garage`.
  - `checkIn` must be at least today 00:00, and `checkOut` must be later than `checkIn`.
  - There is **no passenger-count field in either create form**.
- **Auth.** `authMiddleware` uses a denylist (`STAFF_ONLY_API_PREFIXES`, `src/middleware/auth.ts:24-39`). A new `/api/voice/*` route is allowed for any signed-in user, driver role included, which is what we want. It falls under the 120 req/min per-IP rate limiter (`src/middleware/rate-limit.ts`).
- **External-call pattern.** KTW uses a port, an adapter and a service:
  - `src/lib/ktw/ktw-arrivals.port.ts`
  - `src/lib/ktw/katowice-board.adapter.ts:150-195`, with an AbortController timeout and typed errors
  - `src/lib/services/ktw-arrival-hours.service.ts`, which stubs when `process.env.VITEST === "true"`

  Secrets are read through `import.meta.env`, with a `process.env` fallback in `katowice-board.adapter.ts:28-33`.
- **Tests.** Vitest runs with `environment: "node"`. There is no jsdom and no `@testing-library`, and no `*.test.tsx` exists. API handlers are tested by calling the exported handler with a hand-built context (`src/pages/api/driver/reservations/index.test.ts`). E2E uses Playwright with a staff storageState (`e2e/auth.setup.ts`) and follows the rules in `e2e/E2E-RULES.md`.
- **PoC.** `scripts/soniox-poc/` holds `SONIOX_CONTEXT`, 15 scenarios and real transcripts. Results are in `research.md` → "PoC results".

## Desired End State

- In the staff "Nowa rezerwacja" modal, a mic button is visible in both modes. Clicking it in quick mode switches to full mode, keeping the entered values, and starts listening.
- While listening:
  - a live transcript preview shows what Soniox heard, partial text included;
  - fields fill as soon as a segment is finalized, within about 1.5 s of a pause;
  - voice-filled fields carry a "z głosu" highlight, and fields whose source tokens had low confidence get a warning highlight;
  - spoken corrections ("nie, przepraszam, siedemnastego") replace the earlier value;
  - a field the user edited by hand is never overwritten by voice.
- A voice-filled license plate shows prominently with a "Potwierdź rejestrację" action, and submit stays disabled until the plate is confirmed or edited by hand. An implausible plate format shows a non-blocking warning.
- Price and availability update through the existing hooks.
- Stopping the mic (button, modal close, 10-minute cap, or error) ends the Soniox session. Nothing from the transcript is stored.
- The driver "Nowa rezerwacja" dialog has the same mic flow with identical rules (no email field there).
- `POST /api/voice/token` returns a short-lived Soniox key for any signed-in user, 401 for anonymous users, and 503 when Soniox is not configured. The mic button is hidden when `PUBLIC_VOICE_ENABLED !== "true"`.
- All automated checks pass, including the parser corpus tests built from PoC transcripts and one staff E2E test that uses a fake transcript source.

### Key Discoveries:

- The PoC showed Soniox applies its own inverse text normalization (ITN). Plate errors cluster in repeated digits (`007`→`07`) and in high-confidence swaps (`7142`→`7124`), so plate confirmation must not depend on confidence alone (`research.md`, "PoC results" items 1-3).
- `@soniox/client@2.3.0` provides:
  - `region` (`"eu"` → `stt-rt.eu.soniox.com`), plus an async `config` function called once per recording to fetch a temporary key;
  - `max_endpoint_delay_ms` (500-3000, default 2000), `finalize()`, `pause()` / `resume()` and auto-reconnect;
  - an injectable `source: AudioSource` (defaulting to `MicrophoneSource`).

  The default 2000 ms endpoint delay explains most of the PoC's ~5 s final latency.
- Temporary key: `POST https://api{.eu}.soniox.com/v1/auth/temporary-api-key` with body `{ "usage_type": "transcribe_websocket", "expires_in_seconds": 60 }` returns `{ api_key, expires_at }`. The key is needed only to open the WebSocket.
- Both forms are browser-local-time based. The parser therefore emits local `{ date: "YYYY-MM-DD", time: "HH:mm" | null }` values, and each form converts them with its existing conventions (a `Date` for staff, a `datetime-local` string for drivers).

## What We're NOT Doing

- No LLM extraction and no second AI provider.
- No storage of audio or transcripts, and no "append transcript to notes".
- No passenger count, since neither create form has that field. No returning-customer lookup.
- No relative-date phrases beyond `dziś/dzisiaj`, `jutro`, `pojutrze` and a bare weekday name (for example "za tydzień w środę" is out). No flight-direction lemmatization: the text is kept as spoken, e.g. "Londynu Stansted".
- No telephony or call recording, and no voice for edit forms or walk-in arrivals.
- No changes to the price or availability hooks (for example adding a debounce to `useCostCalculation`). Voice applies values only on finalized segments, a few times per call.
- No new role rules. `/api/voice/*` stays open to staff and drivers.
- No live Soniox calls in CI.

## Implementation Approach

The work goes bottom-up so each layer is testable before the UI exists. The pure parser and merge logic come first and carry the risky Polish-language rules, so they get the deepest unit coverage. The thin server endpoint comes next, then the browser capture module behind a `TranscriptSource` interface, so the UI never touches the SDK directly and E2E can inject a fake. The forms integrate last; staff first, because it has availability gating and the quick/full switch.

**Parsing strategy.** The parser always re-parses the **whole accumulated final transcript** and returns the latest value per field ("last mention wins"). That makes corrections and parking-type changes fall out naturally, with no incremental state. Partial (non-final) text is only shown in the preview, never applied, which avoids field flicker.

## Critical Implementation Details

- **State sequencing (provenance).** Each form field carries a provenance value: `empty | voice | manual`. Voice may overwrite `empty` and `voice`, never `manual`. Marking a field `manual` must happen in the user's `onChange` path, while voice writes through `form.setValue`. The two paths must stay separate, or a voice write would mark itself manual. Any manual edit of the plate also counts as confirming it.
- **Timing and lifecycle.** The Soniox recording must be stopped (`cancel()`) when the modal or dialog closes, when the component unmounts, when the mode switches away, and after the 10-minute cap. Otherwise the session keeps billing. Request a Wake Lock while listening and release it on stop. On `visibilitychange` back to visible, call `recording.reconnect()`, as the SDK docs recommend after sleep and wake.
- **Year rollover.** A spoken day and month without a year resolves to the nearest date at or after today (Warsaw). If the resulting check-out lands before the check-in, it moves to the next year. That covers the PoC's "1 grudnia do 6 stycznia" case.

## Phase 1: Transcript parser and merge logic

### Overview

Pure TypeScript in `src/lib/voice/`, with no React and no SDK. It turns a Soniox transcript (plus optional token confidences) into partial reservation fields with source spans, and merges them into form state under the provenance rules.

### Changes Required:

#### 1. Parser types and entry point

**File**: `src/lib/voice/parse-transcript.ts`

**Intent**: Single entry point that runs all field extractors on the full final transcript and returns the latest value per field, each with its character span, so confidence can be mapped back to it.

**Contract**:
```ts
export interface VoiceTokenSpan { start: number; end: number; confidence: number } // char offsets in transcript
export interface VoiceField<T> { value: T; span: [number, number]; lowConfidence: boolean }
export interface VoiceDateTime { date: string /* YYYY-MM-DD */; time: string | null /* HH:mm */ }
export interface ParsedVoiceFields {
  lastName?: VoiceField<string>; firstName?: VoiceField<string>;
  phone?: VoiceField<string /* 9 digits */>; email?: VoiceField<string>;
  licensePlate?: VoiceField<string /* uppercase, no spaces */> & { formatWarning: boolean };
  checkIn?: VoiceField<VoiceDateTime>; checkOut?: VoiceField<VoiceDateTime>;
  parkingType?: VoiceField<ParkingType>; flightDirection?: VoiceField<string>;
}
export function parseReservationTranscript(
  transcript: string,
  opts: { today: string /* YYYY-MM-DD, Warsaw */; tokens?: VoiceTokenSpan[]; lowConfidenceBelow?: number /* default 0.7 */ },
): ParsedVoiceFields;
```

#### 2. Field extractors

**File**: `src/lib/voice/extractors/*.ts`: `names.ts`, `phone.ts`, `email.ts`, `plate.ts`, `dates.ts`, `parking-type.ts`, `flight.ts`

**Intent**: One small module per field, with rules derived from the PoC transcripts in `research.md` and `scripts/soniox-poc/scenarios.json`:

- **names**:
  - Explicit `nazwisko X` and `imię X` win.
  - Otherwise use a capitalized pair after `pan/pani/państwo` or at segment start, where the first word is in a bundled Polish first-name dictionary: that is first name + last name.
  - A lone capitalized word at segment start is the last name (e.g. "Kowalczyk, 14 listopada").
  - Hyphenated surnames are kept.
  - Output must satisfy the `lastName` regex (letters, spaces, hyphen).
- **phone**:
  - Take the digit groups after `telefon|tel.|numer telefonu|komórka` and drop a `+48` / `48` prefix.
  - If the result is not exactly 9 digits, try group repair: merge `X00 YY` → `XYY` and `X0 Y` → `XY`, as in the PoC's `512 300 45 678` → `512345678` and `700 90 12 34 56` → `790123456`.
  - Emit only a 9-digit result.
- **email**: regex on Soniox output (`anna.nowak@gmail.com`), with a fallback that rebuilds `małpa` / `kropka` words.
- **plate**:
  - Take tokens after `rejestracja|rejestracyjny|tablica|samochód|numer`, but not `numer telefonu`, up to the next keyword or sentence boundary.
  - Strip spaces and hyphens and uppercase the result.
  - `formatWarning` is set when the plate fails `^[A-Z]{1,3}[A-Z0-9]{3,5}$` or its 1-3 letter prefix is not in a bundled list of Polish county codes. The warning is non-blocking.
- **dates**:
  - Recognize `D <month-genitive>`, `D.MM`, a range `od D do D <month>` (the first date inherits the month), and `dziś/dzisiaj/jutro/pojutrze`.
  - A bare weekday means the next occurrence; a weekday followed by an explicit date uses the date.
  - Time comes from a following `o|godzina HH:MM|HH`, plus `rano` / `wieczorem` / `w nocy` adjustments. Soniox emits `6 rano`, `22:00` and `04:40`.
  - Role keywords:
    - check-in: `przyjazd|od|wylot|zostawia|wyjazd`
    - check-out: `powrót|do|wraca|przylot|odbiór`
  - A date with no role keyword right after a correction marker (`nie|przepraszam|poprawiam|a nie`) takes the previous date's role. Otherwise it takes the next unfilled role in order (check-in, then check-out).
  - Year rollover follows the rule under Critical Implementation Details.
- **parking-type**: the last mention wins, from `garaż` → garage, `wiata|zadaszony` → carport, `odkryty|parking odkryty` → open_air.
- **flight**: the next 1-3 words after `lot do|wylot do|przylot z|kierunek`, up to punctuation, kept as spoken.

**Contract**: each extractor is `(text: string, ctx) => VoiceField<T> | undefined` and has no shared mutable state. The first-name dictionary (~300 most common Polish first names) and the county-code list live as `const` arrays in `src/lib/voice/data/`.

#### 3. Merge with provenance

**File**: `src/lib/voice/merge.ts`

**Intent**: Decide which parsed fields to apply to the form, given current provenance, and report plate confirmation state.

**Contract**:
```ts
export type Provenance = "empty" | "voice" | "manual";
export type VoiceFieldKey = keyof ParsedVoiceFields;
export function planVoiceUpdates(
  parsed: ParsedVoiceFields,
  provenance: Partial<Record<VoiceFieldKey, Provenance>>,
  current: Partial<Record<VoiceFieldKey, unknown>>,
): { updates: Partial<ParsedVoiceFields>; nextProvenance: Partial<Record<VoiceFieldKey, Provenance>> };
// Applies only where provenance !== "manual" and value differs. Plate confirmation is tracked by the caller:
// confirmed = provenance.licensePlate === "manual" || userClickedConfirm (reset to false whenever voice changes the plate).
```

#### 4. Corpus tests

**File**: `src/lib/voice/parse-transcript.test.ts`, `src/lib/voice/merge.test.ts`, `src/lib/voice/fixtures/poc-transcripts.ts`

**Intent**: Lock the parser to real Soniox output. Fixtures are the 15 PoC transcripts from the results report (fictional data), each with its expected fields. Targeted cases cover corrections (s03), the parking-type change (s15), year rollover (s10), phone group repair (s09, s12), a hyphenated surname (s09), `Nazwisko …` / `Imię …` (s07), the email (s06), a format warning on an implausible plate, and "no time spoken → time null". Merge tests cover "manual never overwritten", "voice overwrites voice", and "plate confirmation resets when voice changes the plate".

### Success Criteria:

#### Automated Verification:

- Parser and merge unit tests pass: `npm run test -- src/lib/voice`
- At least 13 of the 15 PoC transcript fixtures parse to fully correct expected fields. Remaining misses must be STT errors (e.g. `Gregorczyk`, `KCH07`), asserted as known limitations in the test file.
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification:

- Reviewing the fixture expectations against `research.md` "PoC results" confirms they reflect what a human would enter.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Soniox temporary key endpoint

### Overview

A thin server route that mints a 60-second Soniox key for the signed-in user, following the KTW port, adapter and service pattern.

### Changes Required:

#### 1. Port and adapter

**File**: `src/lib/voice/soniox-token.port.ts`, `src/lib/voice/soniox-token.adapter.ts`

**Intent**: Call Soniox `POST /v1/auth/temporary-api-key` with a timeout and typed errors. The region picks the host.

**Contract**: `createSonioxTokenAdapter({ fetchImpl?, apiKey, region: "eu" | "us", timeoutMs? = 5000 })` returns `{ createTemporaryKey(clientReferenceId: string): Promise<{ apiKey: string; expiresAt: string }> }`.
- Host: `api.eu.soniox.com` for `eu`, `api.soniox.com` otherwise.
- Body: `{ usage_type: "transcribe_websocket", expires_in_seconds: 60, client_reference_id }`.
- Use `redirect: "error"` and clear the timer in `finally`.
- Throws `SonioxTokenError` with codes `not_configured | upstream | timeout`.

#### 2. Route

**File**: `src/pages/api/voice/token.ts`

**Intent**: Return the temporary key and the region the browser SDK must use.

**Contract**:
- `export const prerender = false` and `export const POST`.
- No body. Validate an empty or absent JSON body with a strict empty Zod object, so the boundary rule from `lessons.md` holds.
- Responses: 401 without `locals.user`; 503 `{ error: "voice_not_configured" }` when `SONIOX_API_KEY` is missing; 502 for upstream errors and timeouts; 200 `{ api_key, expires_at, region }`.
- `client_reference_id` = `parktrack-${user.id}`, for usage attribution in the Soniox console.
- Env read via `import.meta.env` with a `process.env` fallback (same helper style as `katowice-board.adapter.ts:28-33`).

#### 3. Env declarations

**File**: `src/env.d.ts`, `.env.example`

**Intent**: Declare `SONIOX_API_KEY?`, `SONIOX_REGION?` (`eu` default) and `PUBLIC_VOICE_ENABLED?`, and document them in `.env.example`, replacing the PoC-only comment.

#### 4. Tests

**File**: `src/pages/api/voice/token.test.ts`, `src/lib/voice/soniox-token.adapter.test.ts`

**Intent**: Handler tests use the injected or mocked adapter and cover 401 / 503 / 502 / 200 plus the response shape. Adapter tests use a fake `fetchImpl` and cover host by region, request body, timeout → `timeout`, and non-OK → `upstream`. Add a case to `src/middleware/auth.test.ts` asserting that a driver may call `/api/voice/token`.

### Success Criteria:

#### Automated Verification:

- Route and adapter tests pass: `npm run test -- src/pages/api/voice src/lib/voice/soniox-token`
- Middleware test passes: `npm run test -- src/middleware/auth.test.ts`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification:

- With a real EU-project key in `.env`, `POST /api/voice/token` from a signed-in browser session returns a key, and the key opens a Soniox WebSocket (e.g. via the PoC runner pointed at it).
- With the key removed, the route returns 503.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Browser voice capture module

### Overview

Wrap the Soniox Web SDK behind a `TranscriptSource` interface, expose a `useVoiceSession` hook, and build the shared UI pieces: the mic button and the transcript preview.

### Changes Required:

#### 1. Dependency

**File**: `package.json`

**Intent**: Add `@soniox/client@^2.3.0`. Import it only from the Soniox source module, so it is bundled only with the islands that use voice.

#### 2. Transcript source abstraction

**File**: `src/lib/voice/transcript-source.ts`, `src/lib/voice/soniox-source.ts`, `src/lib/voice/fake-source.ts`

**Intent**: Decouple the UI from the SDK, and let E2E drive the flow without a mic or the network.

**Contract**:
```ts
export interface TranscriptUpdate { finalText: string; partialText: string; finalTokens: VoiceTokenSpan[] } // offsets into finalText
export interface TranscriptSource {
  start(handlers: { onUpdate(u: TranscriptUpdate): void; onError(e: VoiceError): void; onEnd(): void }): Promise<void>;
  stop(): Promise<void>; // graceful (flush finals)
  cancel(): void;
}
export type VoiceError = { code: "permission_denied" | "not_configured" | "network" | "quota" | "unknown"; message: string };
```
- **Soniox source.** `SonioxClient` with `config: async () => fetch("/api/voice/token", { method: "POST" })` → `{ api_key, region }`. `record({ model: "stt-rt-v5", language_hints: ["pl"], context: SONIOX_CONTEXT, enable_endpoint_detection: true, max_endpoint_delay_ms: 500 })`. The source accumulates final tokens (skipping `<end>` / `<fin>`) and replaces partial text on every `result` event. SDK error classes map to `VoiceError` codes; a 503 from the token route maps to `not_configured`.
- **Context hints.** Move `SONIOX_CONTEXT` from `scripts/soniox-poc/lib.mjs` into `src/lib/voice/soniox-context.ts`. The PoC imports from neither and keeps its own copy.
- **Fake source.** It reads `window.__parktrackFakeVoice` (an array of `{ finalText, partialText?, delayMs }` steps) and emits them in order. `getTranscriptSource()` returns the fake only when `import.meta.env.PUBLIC_VOICE_FAKE === "true"`, so a production build never ships the switch on.

#### 3. Session hook

**File**: `src/hooks/useVoiceSession.ts`

**Intent**: Own the session lifecycle and expose the parsed result to the forms.

**Contract**: `useVoiceSession({ today })` returns `{ state: "idle" | "connecting" | "listening" | "stopping" | "error", error?: VoiceError, finalText, partialText, parsed: ParsedVoiceFields, start(), stop(), cancel() }`.
- `parsed` is recomputed from `finalText` and the final tokens using `parseReservationTranscript`.
- `cancel()` runs on unmount.
- An auto-stop timer fires at 10 minutes.
- Wake Lock is held while listening, and `visibilitychange` triggers a reconnect.
- `today` comes from `warsawDateKey(new Date())` (`src/lib/calendar/warsaw-time.ts:4`).

#### 4. Shared UI

**File**: `src/components/voice/VoiceCaptureButton.tsx`, `src/components/voice/TranscriptPreview.tsx`, `src/components/voice/VoiceFieldBadge.tsx`

**Intent**: Shared, accessible UI with large tap targets for mobile.
- **Mic button.** Labels: "Dyktuj" → "Słucham… (zatrzymaj)". It exposes `aria-pressed` and carries the visible state.
- **Transcript preview.** The final text plus the muted partial text, in an `aria-live="polite"` region.
- **Field badge.** "z głosu", plus a warning variant for low confidence.
- **Error messages (Polish):** no mic permission, voice unavailable (503), connection lost.
- The button renders nothing when `import.meta.env.PUBLIC_VOICE_ENABLED !== "true"`.

### Success Criteria:

#### Automated Verification:

- The fake source and the hook's pure helpers (token accumulation, `<end>`/`<fin>` filtering, offset mapping) have unit tests that pass: `npm run test -- src/lib/voice`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- On a temporary dev-only page or Storybook-free harness, the mic button starts a real Soniox session. Partial text appears in under 1 s, and final text arrives within about 1.5 s after a pause. This confirms the `max_endpoint_delay_ms: 500` setting fixes the PoC latency.
- Denying mic permission shows the permission message, and closing the harness ends the session (it disappears from active sessions in the Soniox console).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Staff form integration

### Overview

Wire voice into `NewReservationModal` and `FullReservationForm`: the quick→full switch, live field filling, provenance highlights, and plate confirmation gating submit.

### Changes Required:

#### 1. Modal entry point

**File**: `src/components/reservations/NewReservationModal.tsx`

**Intent**: Show the mic button in both modes. In quick mode, clicking it switches to full, carrying the existing quick values exactly like today's switch, and starts the session. The modal owns the `useVoiceSession` instance, so the session survives the mode switch. The session is cancelled when the modal closes.

#### 2. Form wiring

**File**: `src/components/reservations/FullReservationForm.tsx`, plus a small adapter `src/lib/voice/apply-to-staff-form.ts`

**Intent**: On every change of `parsed`, call `planVoiceUpdates` and apply the updates with `form.setValue(name, value, { shouldValidate: true, shouldDirty: true })`.
- Map `VoiceDateTime` to a local `Date`, keeping the field's current time when `time` is null.
- Format the phone with the existing `xxx xxx xxx` helper.
- Uppercase the plate.

Each field's user `onChange` additionally marks provenance `manual`. Fields with provenance `voice` render `VoiceFieldBadge`.

**Contract**:
- New optional prop on `FullReservationForm`: `voice?: { parsed: ParsedVoiceFields; active: boolean }`.
- Provenance and plate-confirmed state are local to the form.
- `email` is applied, `flightDirection` goes to `flightDirection`, and `parkingType` goes to `parkingType`. Changing `parkingType` still feeds `CostPreview` through the existing watch.

#### 3. Plate confirmation

**File**: `src/components/reservations/FullReservationForm.tsx`

**Intent**: When the plate has provenance `voice` and is not confirmed, render it large with a "Potwierdź rejestrację" button and the format warning when applicable. Add `!plateConfirmed` to the submit-disabled condition (next to `isAvailable`, line 397), with a hint explaining why submit is disabled.

### Success Criteria:

#### Automated Verification:

- Unit tests for `apply-to-staff-form.ts` pass: date mapping with null time, phone formatting, no-op for manual fields. Command: `npm run test -- src/lib/voice`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Existing reservation and E2E suites still pass: `npm run test`, `npm run test:e2e`

#### Manual Verification:

- Dictating scenario s01 fills surname, first name, dates and times, plate and parking type. The price preview and availability update.
- Dictating s03 (the correction) ends with check-in on 17.10 at 04:40.
- Typing the surname by hand and then dictating a different surname keeps the typed one.
- Submit is blocked until "Potwierdź rejestrację" is clicked. Editing the plate by hand unblocks it.
- Closing the modal mid-dictation stops the mic indicator in the browser tab.
- The quick-mode mic switches to full and keeps the already-typed last name.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Driver form integration

### Overview

The same voice flow in `DriverNewReservationDialog`, adapted to its string-based form values.

### Changes Required:

#### 1. Dialog wiring

**File**: `src/components/driver/DriverNewReservationDialog.tsx`, plus `src/lib/voice/apply-to-driver-form.ts`

**Intent**: The dialog owns a `useVoiceSession` instance, cancelled on close and on reset at open (lines 66-70). It applies `planVoiceUpdates` results with `setValue`:
- map `VoiceDateTime` to a `datetime-local` string, keeping the current time when null;
- ignore `email`, since the driver form has no such field.

It uses the same badges, the same plate confirmation gating its submit button, and the same mobile-sized mic button.

### Success Criteria:

#### Automated Verification:

- Unit tests for `apply-to-driver-form.ts` pass: `npm run test -- src/lib/voice`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification:

- On a phone (driver account, `/kierowca`), dictating s02 fills the fields and the price quote appears.
- Screen lock while listening does not leave a zombie session: after unlock it either reconnects or shows the connection-lost message.
- Plate confirmation blocks submit the same way as on desktop.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 6: E2E test with fake transcript source

### Overview

One Playwright test that covers the whole staff flow from transcript to saved reservation, with no mic and no Soniox.

### Changes Required:

#### 1. Test config

**File**: `playwright.config.ts`

**Intent**: Pass `PUBLIC_VOICE_ENABLED=true` and `PUBLIC_VOICE_FAKE=true` to the `webServer` env, so the dev server under test exposes the button and the fake source.

#### 2. Spec

**File**: `e2e/voice-reservation.spec.ts`

**Intent**: Follow `/10x-e2e` and `e2e/E2E-RULES.md`:
- `page.addInitScript` seeds `window.__parktrackFakeVoice` with s01-like steps, using a unique surname with a timestamp suffix and future dates.
- Open the modal, click "Dyktuj", and assert the fields via `getByLabel`.
- Assert submit is disabled until "Potwierdź rejestrację" is clicked.
- Save, wait for the `POST /api/reservations` response, and assert the success toast.
- Clean up by cancelling or deleting the created reservation in `afterEach`.
- Wait for hydration using the same pattern as `e2e/seed.spec.ts`. Never use `waitForTimeout`.

### Success Criteria:

#### Automated Verification:

- E2E passes locally: `npm run test:e2e -- e2e/voice-reservation.spec.ts`
- Full suite passes: `npm run test:e2e`
- CI job `ci` passes (test → lint → build).

#### Manual Verification:

- Reviewing the spec against the five anti-patterns in the `/10x-e2e` references shows no violations.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Parser corpus built from the 15 PoC transcripts, plus targeted rules:
  - corrections
  - parking-type change
  - year rollover
  - phone group repair
  - hyphenated or explicit surname
  - email
  - plate format warning
  - null time
- Merge provenance rules and plate confirmation reset.
- Form adapters: date mapping (staff `Date`, driver `datetime-local`), phone formatting.
- Soniox token adapter (host by region, body, timeout, upstream error) and route (401/503/502/200).
- Middleware: a driver may call `/api/voice/token`.

### Integration Tests:

- The E2E staff flow with the fake source, from transcript to fields, confirm and save.

### Manual Testing Steps:

1. With an EU-project key, dictate PoC scenarios s01, s03 and s15 in the staff modal and check the fields, corrections and parking-type change.
2. Measure the delay from a pause to fields filling. It should be about 1.5 s or less.
3. Run a driver phone session on `/kierowca`, including screen lock and unlock.
4. Remove `SONIOX_API_KEY` and check the button shows the "voice unavailable" message on start.

## Performance Considerations

- Voice applies values only on finalized segments, which keeps setValue → `useCostCalculation` (no debounce) calls to a handful per call. Monitor the network tab in manual tests, and if it becomes noisy, revisit with a separate change.
- `@soniox/client` is imported only by `soniox-source.ts`, so the dashboard bundle grows only for the islands that render the voice button.
- Cost: Soniox bills by stream duration. The 10-minute auto-stop and cancel-on-close keep forgotten sessions from billing.

## Migration Notes

- No DB changes.
- Before production:
  - create a Soniox project in the **EU** region, sign its DPA and set `SONIOX_API_KEY` (from the EU project), `SONIOX_REGION=eu` and `PUBLIC_VOICE_ENABLED=true` on Railway;
  - add Soniox to the privacy policy as a processor and inform staff.
- Rollback: set `PUBLIC_VOICE_ENABLED=false`, or remove the key, which leaves the button hidden or unavailable.

## References

- Change identity and decisions: `context/changes/voice-reservations/change.md`
- Research and PoC results: `context/changes/voice-reservations/research.md`
- PoC harness: `scripts/soniox-poc/` (README, `lib.mjs` `SONIOX_CONTEXT`, `scenarios.json`)
- External-call pattern: `src/lib/ktw/katowice-board.adapter.ts:150-195`, `src/lib/services/ktw-arrival-hours.service.ts`
- Staff form: `src/components/reservations/FullReservationForm.tsx:36-52, 397`; modal: `src/components/reservations/NewReservationModal.tsx:19-116`
- Driver form: `src/components/driver/DriverNewReservationDialog.tsx:28-94`
- Auth denylist: `src/middleware/auth.ts:24-39`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Transcript parser and merge logic

#### Automated

- [x] 1.1 Parser and merge unit tests pass — 51eec35
- [x] 1.2 At least 13 of 15 PoC transcript fixtures parse fully correct; remaining misses asserted as STT limitations — 51eec35
- [x] 1.3 Type checking passes — 51eec35
- [x] 1.4 Linting passes — 51eec35

#### Manual

- [x] 1.5 Fixture expectations reviewed against PoC results — 51eec35

### Phase 2: Soniox temporary key endpoint

#### Automated

- [x] 2.1 Route and adapter tests pass
- [x] 2.2 Middleware test passes (driver allowed)
- [x] 2.3 Type checking passes
- [x] 2.4 Linting passes

#### Manual

- [ ] 2.5 Real EU key: token route returns a key that opens a Soniox WebSocket
- [ ] 2.6 Without key: route returns 503

### Phase 3: Browser voice capture module

#### Automated

- [ ] 3.1 Fake source and hook helper unit tests pass
- [ ] 3.2 Type checking passes
- [ ] 3.3 Linting passes
- [ ] 3.4 Build passes

#### Manual

- [ ] 3.5 Real session: partial < 1 s, final ≤ ~1.5 s after a pause
- [ ] 3.6 Permission-denied message shown; closing ends the session

### Phase 4: Staff form integration

#### Automated

- [ ] 4.1 Staff form adapter unit tests pass
- [ ] 4.2 Type checking passes
- [ ] 4.3 Linting passes
- [ ] 4.4 Existing unit and E2E suites still pass

#### Manual

- [ ] 4.5 s01 dictation fills all fields; price and availability update
- [ ] 4.6 s03 correction ends with check-in 17.10 04:40
- [ ] 4.7 Manually typed field not overwritten by voice
- [ ] 4.8 Submit blocked until plate confirmed or edited
- [ ] 4.9 Closing modal stops the mic
- [ ] 4.10 Quick-mode mic switches to full and keeps typed values

### Phase 5: Driver form integration

#### Automated

- [ ] 5.1 Driver form adapter unit tests pass
- [ ] 5.2 Type checking passes
- [ ] 5.3 Linting passes

#### Manual

- [ ] 5.4 Phone: s02 dictation fills fields and price quote
- [ ] 5.5 Screen lock leaves no zombie session
- [ ] 5.6 Plate confirmation blocks driver submit

### Phase 6: E2E test with fake transcript source

#### Automated

- [ ] 6.1 Voice E2E spec passes locally
- [ ] 6.2 Full E2E suite passes
- [ ] 6.3 CI job `ci` passes

#### Manual

- [ ] 6.4 Spec reviewed against the five E2E anti-patterns
