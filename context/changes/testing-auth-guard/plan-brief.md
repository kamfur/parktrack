# Auth Guard Tests — Plan Brief

> Full plan: `context/changes/testing-auth-guard/plan.md`
> Research: `context/changes/testing-auth-guard/research.md`

## What & Why

Bootstrap Vitest and write contract tests asserting that all new M-1 routes
(`/faktury/*`, `/api/invoices`, `/api/stats`) are protected by the auth
middleware. Covers Risk #5 from `context/foundation/test-plan.md` Phase 1:
protection is real today but implicit and untested — a single allowlist
regression would silently expose invoice and stats data.

## Starting Point

No test runner, no test files, no test scripts exist. `isPublicPath()` in
`src/middleware/auth.ts` is the single control point for all auth routing
decisions; it is a pure function but currently unexported. The new M-1 routes
are protected by catch-all (anything not on the public allowlist), not by
explicit listing.

## Desired End State

`npm run test` passes. The test file reads as an executable policy contract:
each new M-1 route is asserted as protected, each public route as allowed,
and the `authMiddleware` handler's 401/302 branch logic is verified with a
minimal mock context. No server, no Supabase, no browser required.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| How to expose `isPublicPath` | Add `export` to existing fn in `auth.ts` | One keyword, zero restructuring | Plan |
| Test file location | Colocated (`src/middleware/auth.test.ts`) | Standard Vitest convention, no extra directory | Plan |
| Test scope | `isPublicPath` unit + `authMiddleware` mock-context | Covers pure-function regressions AND handler branch logic | Plan |
| Env vars for tests | `.env.test` with dummy values + `envDir` | Standard Vite/Vitest convention; scales to later phases | Plan |
| Test layer | Function-level (no server) | `isPublicPath` is pure; `authMiddleware` is injectable — server not needed | Research |

## Scope

**In scope:**
- Vitest install and configuration
- `vitest.config.ts` with `node` environment and `@/*` alias
- `.env.test` with dummy values (foundation for later phases)
- `package.json` test scripts
- `isPublicPath` export + unit tests (15 path assertions)
- `authMiddleware` handler tests (6 mock-context cases)

**Out of scope:**
- HTTP-level / server integration tests
- `supabaseMiddleware` or `rateLimiter` tests
- CI pipeline wiring (Phase 4 of the test rollout)
- Playwright or browser tests

## Architecture / Approach

The auth middleware uses an explicit public-route allowlist; anything not on
the list is protected by default. `isPublicPath()` is the single decision
point. Tests import it directly after adding `export`; no server or Supabase
client is involved. `authMiddleware` tests use a plain mock context object
(`{ url: { pathname }, locals: { user }, redirect }`) and a stub `next`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Vitest Bootstrap | Working test runner with one smoke test | Config error silently causes tests to not run |
| 2. Auth Guard Tests | Full contract test suite for Risk #5 | Mock context doesn't accurately reflect real Astro middleware context |

**Prerequisites:** None. No Supabase, no running server, no migrations required.
**Estimated effort:** ~1 session across 2 small phases.

## Open Risks & Assumptions

- The mock context object `{ url: { pathname }, locals: { user }, redirect }`
  is sufficient because `authMiddleware` only reads `url.pathname`,
  `locals.user`, and calls `redirect()` — verified by reading the function
  body. If the function is later extended to use other context fields, the
  mock will need updating.
- `import.meta.env` is polyfilled by Vitest via `.env.test`. Phase 1/2 tests
  don't call Supabase, so this is moot for now; later phases must verify the
  polyfill works correctly for Supabase-importing code.

## Success Criteria (Summary)

- `npm run test` exits 0 with all tests passing
- Test output names each new M-1 route path explicitly (readable as a policy
  document, not just a passing number)
- Temporarily removing one M-1 route assertion causes the test to fail (real
  signal confirmed)
