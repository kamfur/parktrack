# Settings admin-client + stats correctness — Plan Brief

> Full plan: `context/changes/testing-settings-stats/plan.md`
> Research: `context/changes/testing-settings-stats/research.md`

## What & Why

Phase 3 of the test rollout closes Risk #3 (settings/stats admin-client 503 guard can regress)
and Risk #6 (Warsaw timezone offset stripped from stats boundary strings, causing month-end
revenue miscounts). Both risks are already implemented correctly in production; these tests
prevent regression.

## Starting Point

`PATCH /api/settings` and `GET /api/stats` both already return HTTP 503 when the admin client
is null (the risk description in test-plan §2 was stale — corrected in Phase 1).
`getWarsawPeriodBounds()` is a pure function in `stats.ts` that is not yet exported, blocking
unit testing.

## Desired End State

Two new test files (`settings.test.ts`, `stats.test.ts`) are part of `npm run test`. Five new
test cases pass: two 503 regression guards (one per handler) and three timezone boundary cases
(CEST, CET, UTC/Warsaw month-end). Cookbook §6.5 is filled with the patterns so future
contributors can follow them. test-plan §2 Risk #3 description reflects current code.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| `getWarsawPeriodBounds` placement | Export in place (stats.ts) | One keyword, no file movement, test imports from where the code runs | Plan |
| DST coverage | Both CEST (+02:00) and CET (+01:00) | Catches a hardcoded-offset regression — the exact bug dynamic DST resolution guards against | Plan |
| Stats 503 scope | Include `GET /api/stats` alongside PATCH settings | Symmetric guard on the same admin-client pattern, zero extra setup cost | Plan |
| test-plan §2 correction | Correct it inline (Phase 1) | Keeps the authoritative source accurate; stale description misleads future contributors | Plan |
| SSR silent failure | Document-only (not tested) | `ustawienia.astro` read has no export surface testable without a running server | Research |

## Scope

**In scope:**
- Export `getWarsawPeriodBounds` in `src/pages/api/stats.ts`
- Correct Risk #3 description in `context/foundation/test-plan.md §2`
- `src/pages/api/settings.test.ts` — PATCH 503 guard
- `src/pages/api/stats.test.ts` — GET 503 guard + 3 timezone unit tests
- Fill cookbook `test-plan.md §6.5`

**Out of scope:**
- SSR silent failure in `ustawienia.astro` (no testable surface)
- `getWarsawPeriodBounds("day")` tests (same offset logic; month is sufficient)
- Revenue integration test against Supabase (unit test on the boundary function is the right layer)
- E2E or browser testing

## Architecture / Approach

Direct handler import pattern (same as `auth.test.ts`): import the named export, construct a
minimal mock context struct, call the function, assert the Response. For the admin-client null
path, `vi.mock("../../lib/supabase-admin")` intercepts the import and returns `null` from
`createSupabaseAdminClient`. For the timezone tests, `vi.useFakeTimers()` +
`vi.setSystemTime()` feeds a known `Date` to the pure function; `vi.useRealTimers()` in
`afterEach` prevents bleed.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Code preparation | `export` keyword added, §2 corrected | Build breaks if export changes signature (it doesn't) |
| 2. 503 regression tests | settings.test.ts + stats.test.ts 503 cases | vi.mock hoisting pitfall if import order is wrong |
| 3. Timezone tests + cookbook | 3 Date-mocked cases, §6.5 filled | Intl.DateTimeFormat behaviour with fake timers (verified compatible) |

**Prerequisites:** Vitest configured (Phase 1 of rollout — `testing-auth-guard`, complete)
**Estimated effort:** ~1 session, 3 short phases

## Open Risks & Assumptions

- `vi.useFakeTimers()` propagates the mocked Date into `Intl.DateTimeFormat` — verified
  behaviorally in the research phase; if a Vitest upgrade breaks this, the tests will fail
  with an offset mismatch (not silently pass).
- The SSR read silent failure (`ustawienia.astro`) remains untested; any 503 on a subsequent
  PATCH will surface the problem to the user, so data loss is prevented even without a test
  on the read path.

## Success Criteria (Summary)

- `npm run test` passes with five new test cases visible in verbose output
- Sanity oracles (temporarily breaking the code) flip the expected test cases to red
- `test-plan.md §6.5` is filled; `§2` Risk #3 no longer references "silent 200"
