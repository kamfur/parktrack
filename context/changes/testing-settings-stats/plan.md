# Settings admin-client + stats correctness — Implementation Plan

## Overview

Phase 3 of the test rollout (`context/foundation/test-plan.md §3`). Closes Risk #3 (admin-client
503 guard can regress to silent 200) and Risk #6 (Warsaw timezone offset stripped from stats
boundary strings). Two test files are created; one code change (export) and one doc correction
are prerequisites.

## Current State Analysis

**Risk #3 — partially mischaracterised in test-plan §2.**
`PATCH /api/settings` (`src/pages/api/settings.ts:84–91`) already returns HTTP 503 when
`createSupabaseAdminClient()` returns null — the handler is not silent. `GET /api/stats`
(`src/pages/api/stats.ts:67–74`) has the identical guard. The real risk is regression: a
future refactor that removes the null check would produce a silent 200 or runtime crash.
The test-plan §2 description will be corrected as part of Phase 1. The SSR read in
`src/pages/ustawienia.astro:15–31` does fail silently (renders hardcoded defaults) but has
no export surface — documented in "What We're NOT Doing."

**Risk #6 — cleanly testable once the function is exported.**
`getWarsawPeriodBounds()` at `src/pages/api/stats.ts:11` is a pure function that constructs
ISO 8601 boundary strings with an explicit Warsaw UTC offset. It is not currently exported.
Adding the `export` keyword is the only prerequisite. The function resolves DST dynamically
via `Intl.DateTimeFormat` — both CEST (+02:00, summer) and CET (+01:00, winter) paths are
testable by mocking `Date`.

### Key Discoveries:

- `src/pages/api/stats.ts:11` — `function getWarsawPeriodBounds(...)` not exported; one keyword addition enables unit testing
- `src/pages/api/settings.ts:84–91` — 503 already returned; test guards against regression, not current bug
- `src/pages/api/stats.ts:67–74` — identical admin-client guard; symmetric coverage closes the surface
- `src/middleware/auth.test.ts` and `src/lib/services/invoice.service.test.ts` — established patterns: direct handler import, minimal mock context, `vi.mock` for module dependencies
- `src/lib/supabase-admin.ts:10–32` — `createSupabaseAdminClient()` returns `null` (no throw) when `SUPABASE_SERVICE_ROLE_KEY` absent

## Desired End State

Two test files (`src/pages/api/settings.test.ts`, `src/pages/api/stats.test.ts`) pass under
`npm run test`. Specifically:

- `PATCH /api/settings` returns 503 when the admin client is null
- `GET /api/stats` returns 503 when the admin client is null
- `getWarsawPeriodBounds("month")` returns ISO 8601 strings with `+02:00` offset when now is
  in CEST, `+01:00` when in CET, and correctly assigns a UTC/Warsaw boundary instant to the
  Warsaw calendar month
- Cookbook `test-plan.md §6.5` is filled with the patterns used
- `test-plan.md §2` Risk #3 description reflects current code (503, not silent 200)

## What We're NOT Doing

- **SSR silent failure in `ustawienia.astro`** — the page silently renders defaults when the
  admin client is null, but this path has no testable export surface without a running Astro
  server. Documented as a known residual risk.
- **Day period timezone tests** — `getWarsawPeriodBounds("day")` follows the same offset logic;
  testing month is sufficient to cover the regression scenario.
- **Revenue integration test** — the actual Supabase query using `{start, end}` is not tested
  here; the unit test on the boundary function is the correct layer per the risk response table
  in `test-plan.md §2`.
- **E2E or browser testing** — out of M-1 rollout scope.

## Implementation Approach

Three phases. Phase 1 is a pure prep phase (one code change + one doc correction) with no
test logic. Phases 2–3 write tests in order of dependency: 503 guards first (they don't
require the export), timezone tests second (they require the Phase 1 export). The `vi.mock`
module-mock pattern from `auth.test.ts` and the fake-timer pattern from Vitest are the
implementation primitives.

## Critical Implementation Details

**`vi.mock` hoisting**: Vitest hoists `vi.mock(...)` calls to the top of the file regardless
of where they appear. Always import the mocked module after the `vi.mock` call to get the
mocked version; otherwise the import binds to the real module.

**Fake timers and `Intl.DateTimeFormat`**: `vi.useFakeTimers()` intercepts `new Date()` but
does **not** mock `Intl.DateTimeFormat`. The function uses `Intl.DateTimeFormat` to resolve
the Warsaw offset from `now`. Vitest's fake timers do propagate the mocked `Date` value as
the `now` argument to `Intl.DateTimeFormat` formatters (tested against Vitest ≥ 1.0), so
`vi.setSystemTime(...)` is sufficient — no additional Intl mock needed.

---

## Phase 1: Code preparation and doc correction

### Overview

Export `getWarsawPeriodBounds` and correct the stale Risk #3 description in `test-plan.md §2`.
No tests are written yet; this phase creates the prerequisites for Phases 2–3.

### Changes Required:

#### 1. Export `getWarsawPeriodBounds`

**File**: `src/pages/api/stats.ts:11`

**Intent**: Make the pure boundary function importable by the test file without moving it.

**Contract**: Change `function getWarsawPeriodBounds(...)` to `export function getWarsawPeriodBounds(...)`. Signature and body are unchanged.

#### 2. Correct stale Risk #3 in test-plan.md §2

**File**: `context/foundation/test-plan.md`

**Intent**: The §2 Risk #3 description says "PATCH returns 200 but nothing persists" — this
no longer matches the code. Update it to reflect that the current handler returns 503 and the
regression risk is the null-check being removed, not a currently-silent write.

**Contract**: In the Risk Map table row for Risk #3, update the risk description to:
"Settings write fails with a visible 503 when the service role key is absent — if the null
check is removed in a future refactor, PATCH reverts to a crash or silent success; the SSR
page read still fails silently (renders hardcoded defaults) with no user warning."

### Success Criteria:

#### Automated Verification:

- Build succeeds with no new TypeScript errors: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- `src/pages/api/stats.ts:11` reads `export function getWarsawPeriodBounds`
- `context/foundation/test-plan.md §2` Risk #3 description no longer references "PATCH returns 200 but nothing persists"

**Implementation Note**: After automated verification passes, confirm manually that the export keyword is present before proceeding to Phase 2.

---

## Phase 2: Admin-client 503 regression tests

### Overview

Two test files; each asserts that the relevant handler returns HTTP 503 when
`createSupabaseAdminClient()` returns null. This guards against a regression where the
null-check is removed or the handler falls back to the anon client.

### Changes Required:

#### 1. Settings PATCH 503 test

**File**: `src/pages/api/settings.test.ts` (new file)

**Intent**: Assert that `PATCH /api/settings` returns 503 with a meaningful error body when
the admin client is unavailable, so a regression that removes the null-check is caught.

**Contract**: Import `PATCH` from `./settings`. Mock `../../lib/supabase-admin` via `vi.mock`
so `createSupabaseAdminClient` returns `null`. Construct a minimal request context with
`url` (including `?key=eq.daily_rate`) and `request.json()`. Assert `res.status === 503` and
that the JSON body contains an `error` field mentioning `SUPABASE_SERVICE_ROLE_KEY`. Use the
same `makeCtx` helper pattern as `auth.test.ts`.

#### 2. Stats GET 503 test

**File**: `src/pages/api/stats.test.ts` (new file)

**Intent**: Assert that `GET /api/stats` returns 503 when the admin client is null,
symmetric to the settings guard.

**Contract**: Import `GET` from `./stats`. Same `vi.mock` on `../../lib/supabase-admin`.
Minimal context: `{ url: new URL("http://localhost/api/stats?period=month") }`. Assert
`res.status === 503`.

### Success Criteria:

#### Automated Verification:

- All tests pass: `npm run test`
- Both new test files are picked up by Vitest (no "no tests found" warnings)

#### Manual Verification:

- Run `npm run test -- --reporter=verbose` and confirm the two 503 test cases appear by name
- Temporarily remove the null-check from either handler and confirm the test fails (sanity check the oracle)

**Implementation Note**: Restore the null-check after the manual sanity check before proceeding to Phase 3.

---

## Phase 3: Warsaw timezone boundary unit tests and cookbook

### Overview

Unit tests on the now-exported `getWarsawPeriodBounds` function covering CEST, CET, and the
UTC/Warsaw month boundary. Fill in cookbook §6.5 with the patterns used.

### Changes Required:

#### 1. Timezone unit tests

**File**: `src/pages/api/stats.test.ts` (extend the file created in Phase 2)

**Intent**: Assert that the month-period bounds carry the correct Warsaw UTC offset for both
DST states, and that a reservation checked out at the UTC/Warsaw month boundary is counted in
the correct Warsaw calendar month.

**Contract**: Three `it(...)` cases inside a `describe("getWarsawPeriodBounds — Warsaw timezone boundary")` block.

- **CEST case**: `vi.setSystemTime(new Date("2026-08-15T10:00:00Z"))` (Warsaw: Aug 15 12:00,
  CEST). Assert `start === "2026-08-01T00:00:00+02:00"` and `end === "2026-09-01T00:00:00+02:00"`.
- **CET case**: `vi.setSystemTime(new Date("2026-01-15T10:00:00Z"))` (Warsaw: Jan 15 11:00,
  CET). Assert `start === "2026-01-01T00:00:00+01:00"` and `end === "2026-02-01T00:00:00+01:00"`.
- **Month boundary case**: `vi.setSystemTime(new Date("2026-09-30T22:00:00Z"))` (= Oct 1
  00:00 Warsaw CEST). Assert `start === "2026-10-01T00:00:00+02:00"`. This is the exact
  instant a reservation's `actual_check_out` would be misclassified if the `${tz}` suffix
  were dropped (UTC interpretation would put it in September).

Call `vi.useRealTimers()` in `afterEach` so fake-timer state does not bleed across tests.

#### 2. Fill cookbook §6.5

**File**: `context/foundation/test-plan.md`

**Intent**: Document the patterns used in this phase so future contributors can follow them
without re-reading the plan.

**Contract**: Replace the `TBD — see §3 Phase 3.` stub in §6.5 with two concise subsections:

- **Admin-client guard test** — how to mock `createSupabaseAdminClient` via `vi.mock`, construct
  a minimal handler context, and assert 503. Reference test: `src/pages/api/settings.test.ts`.
- **Timezone boundary test** — `vi.useFakeTimers()` + `vi.setSystemTime(new Date("...UTC..."))`,
  call the exported function, assert full ISO 8601 string including offset. Reference test:
  `src/pages/api/stats.test.ts`.

### Success Criteria:

#### Automated Verification:

- All tests pass: `npm run test`
- Lint passes: `npm run lint`

#### Manual Verification:

- `npm run test -- --reporter=verbose` shows all three timezone test cases by name
- Temporarily strip the `${tz}` suffix from one return in `getWarsawPeriodBounds` and confirm the boundary case fails (sanity check)
- Restore the suffix; confirm all tests pass again
- §6.5 in `test-plan.md` no longer reads "TBD"

**Implementation Note**: Restore any temporary mutations before marking Phase 3 complete.

---

## Testing Strategy

### Unit Tests:

- `getWarsawPeriodBounds("month")` — three Date-mocked cases: CEST, CET, UTC/Warsaw boundary

### Integration Tests (handler-level):

- `PATCH /api/settings` — admin client null → 503 + error body with key name
- `GET /api/stats` — admin client null → 503

### Manual Testing Steps:

1. Run `npm run test -- --reporter=verbose` and verify all five new test cases appear and pass
2. Sanity-check the settings oracle: temporarily remove the `if (!supabase) { return 503 }` block and confirm the test fails
3. Sanity-check the timezone oracle: temporarily return `start: "2026-08-01T00:00:00"` (no offset) and confirm the CEST test fails

## References

- Research: `context/changes/testing-settings-stats/research.md`
- Prior phase patterns: `src/middleware/auth.test.ts`, `src/lib/services/invoice.service.test.ts`
- Test-plan §2 risk response table: `context/foundation/test-plan.md`
- `src/pages/api/settings.ts:84–91` — PATCH 503 guard
- `src/pages/api/stats.ts:11–54` — `getWarsawPeriodBounds()` (after Phase 1 export)
- `src/pages/api/stats.ts:67–74` — GET 503 guard
- `src/lib/supabase-admin.ts:10–32` — admin client factory

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Code preparation and doc correction

#### Automated

- [x] 1.1 Build succeeds: `npm run build` — 706a1df
- [x] 1.2 Lint passes: `npm run lint` — 706a1df

#### Manual

- [ ] 1.3 `src/pages/api/stats.ts:11` reads `export function getWarsawPeriodBounds`
- [ ] 1.4 test-plan.md §2 Risk #3 description updated (no longer references "PATCH returns 200 but nothing persists")

### Phase 2: Admin-client 503 regression tests

#### Automated

- [x] 2.1 All tests pass: `npm run test` — 8b9a74d
- [x] 2.2 Both 503 test cases appear in verbose output — 8b9a74d

#### Manual

- [ ] 2.3 Sanity-check: remove null-check in one handler, confirm test fails, restore

### Phase 3: Warsaw timezone boundary unit tests and cookbook

#### Automated

- [x] 3.1 All tests pass: `npm run test`
- [x] 3.2 Lint passes: `npm run lint`

#### Manual

- [ ] 3.3 All three timezone test cases appear in verbose output by name
- [ ] 3.4 Sanity-check: strip `${tz}` suffix from one bound, confirm boundary case fails, restore
- [ ] 3.5 §6.5 in test-plan.md no longer reads "TBD"
