# Auth Guard Tests — Implementation Plan

## Overview

Bootstrap Vitest and write contract tests documenting that all new M-1 routes
(`/faktury/*`, `/api/invoices`, `/api/stats`) are protected by auth middleware.
Covers Risk #5 from `context/foundation/test-plan.md` Phase 1.

## Current State Analysis

No test runner, no test files, no test scripts exist. Auth protection is real
but undocumented — no test would catch a regression where a route accidentally
ended up on the public allowlist.

`isPublicPath()` in `src/middleware/auth.ts` is the single control point for
all auth routing decisions. It is a pure function (pathname string → bool) but
currently unexported, making it untestable without a one-word code change.

## Desired End State

`npm run test` passes. `src/middleware/auth.test.ts` asserts:
1. Each new M-1 route path returns `false` from `isPublicPath` (protected).
2. Each public route path returns `true` (explicitly allowed).
3. `authMiddleware` returns 401 JSON for unauthenticated API requests.
4. `authMiddleware` returns 302 redirect for unauthenticated page requests.
5. `authMiddleware` calls `next()` for authenticated requests on protected routes.

### Key Discoveries

- `src/middleware/auth.ts:9-23` — `isPublicPath()` is pure (no side effects,
  no I/O). Adding `export` to the function declaration is the only production
  code change this plan requires.
- `src/middleware/auth.ts:34-56` — `authMiddleware` is a standard Astro
  `MiddlewareHandler`. Testable with a minimal mock context
  `{ url: { pathname }, locals: { user }, redirect }` and a `next` stub.
  No Supabase, no server, no browser needed.
- `src/middleware/index.ts:13` — Middleware runs in sequence:
  `supabaseMiddleware → authMiddleware → rateLimiter`. Tests call
  `authMiddleware` directly in isolation; `supabaseMiddleware` is not involved.
- `tsconfig.json:9` — `@/*` alias → `./src/*`; must be mirrored in
  `vitest.config.ts` `resolve.alias`.
- `src/pages/api/stats.ts` — uses `createSupabaseAdminClient()`, no
  `locals.user` check. Relies 100% on middleware. Must be covered in
  `isPublicPath` tests (not handler tests).
- `.env.test` dummy values are not needed for Phase 1/2 tests (auth.ts
  imports no Supabase code) but are created now as the foundation for Phases
  2–3 of the test rollout.

## What We're NOT Doing

- No server spin-up or HTTP-level integration tests (function-level is
  sufficient for Risk #5 at this phase)
- No Playwright / browser tests
- No Supabase client mocking (auth.ts imports no Supabase code)
- No tests for `supabaseMiddleware` or `rateLimiter` (separate concerns)
- No CI pipeline wiring (that is Phase 4 of the test rollout)

## Implementation Approach

Two phases: (1) infrastructure — install Vitest, write config, add scripts,
create `.env.test`, prove the runner starts with a smoke test; (2) tests —
export `isPublicPath`, write the full auth guard test suite.

## Critical Implementation Details

**`authMiddleware` reads `context.url.pathname` via destructuring**
(`const { pathname } = context.url`). The mock context object therefore needs
`url: { pathname }` — not a full `URL` instance. A plain object literal is
sufficient.

**`authMiddleware` is exported from `auth.ts`; `isPublicPath` is not.**
Phase 2 adds `export` only to `isPublicPath`. The three `const` arrays above
it (`PUBLIC_PAGE_PREFIXES`, `PUBLIC_API_PREFIXES`, `PUBLIC_ASSET_PREFIXES`)
are NOT exported — tests import and call `isPublicPath`, not the arrays
directly.

---

## Phase 1: Vitest Bootstrap

### Overview

Install Vitest, write `vitest.config.ts`, create `.env.test` with dummy
values, add `test` and `test:watch` scripts to `package.json`, and add a
minimal smoke test so `npm run test` exits 0.

### Changes Required

#### 1. Install dev dependencies

**File**: `package.json` (devDependencies section, via npm)

**Intent**: Install Vitest and the optional UI companion as dev-only
dependencies.

**Contract**: Run `npm install -D vitest @vitest/ui`. Adds entries to
`devDependencies` and updates `package-lock.json`.

#### 2. Add test scripts

**File**: `package.json`

**Intent**: Expose `npm run test` (CI-safe one-shot run) and
`npm run test:watch` (interactive watch mode).

**Contract**: Add alongside the existing `lint`, `lint:fix`, and `format`
scripts:
```json
"test":       "vitest run",
"test:watch": "vitest"
```

#### 3. Create Vitest config

**File**: `vitest.config.ts`

**Intent**: Configure Vitest with the `node` test environment, the `@/*`
path alias (mirrors `tsconfig.json`), and the project root as the env file
directory so `.env.test` is loaded automatically.

**Contract**: Use `defineConfig` from `vitest/config`. Set
`test.environment: "node"`, `test.envDir: "."`, and
`resolve.alias: { "@": resolve(__dirname, "./src") }`.

#### 4. Create .env.test

**File**: `.env.test`

**Intent**: Provide clearly-dummy (non-production) values for env vars the
Supabase clients require, so future test phases that import Supabase code
don't throw on startup.

**Contract**: Set `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
and `API_SECRET_KEY` to dummy strings (e.g. `http://localhost:54321`,
`test-anon-key`). Must NOT contain real credentials. Must be committed.

#### 5. Smoke test

**File**: `src/middleware/auth.test.ts`

**Intent**: A single passing test that proves the runner is configured and
starts correctly. Phase 2 replaces this content with the real test suite.

**Contract**: One `describe` block, one `it` with a trivial assertion
(`expect(1 + 1).toBe(2)` or similar). No imports from the source tree yet.

### Success Criteria

#### Automated Verification

- `npm run test` exits 0 with one passing test
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification

- Running `npm run test` in the terminal shows the runner starting, one test
  passing, and exit code 0

---

## Phase 2: Auth Guard Tests

### Overview

Export `isPublicPath` from `auth.ts`, then replace the smoke test with a full
contract test suite asserting every new M-1 route is protected and every
public route stays public. Add `authMiddleware` handler tests to cover the
401 / 302 branch logic.

### Changes Required

#### 1. Export `isPublicPath`

**File**: `src/middleware/auth.ts`

**Intent**: Make `isPublicPath` importable by tests. This is the only
production code change in this phase.

**Contract**: Add `export` to the existing `function isPublicPath` declaration
(line 9). Function signature, body, and the three constant arrays above it
remain unchanged.

#### 2. Full auth guard test suite

**File**: `src/middleware/auth.test.ts`

**Intent**: Replace the Phase 1 smoke test with the contract test suite for
`isPublicPath` and `authMiddleware`. Tests serve as executable documentation
of the middleware's protection policy and will catch any future allowlist
regression.

**Contract**: Two `describe` blocks.

**Block 1 — `isPublicPath`**: assert `false` (protected) and `true` (public)
for each of the following paths:

| Pathname | Expected |
|---|---|
| `/faktury/nowy` | `false` |
| `/faktury/some-id/druk` | `false` |
| `/api/invoices` | `false` |
| `/api/invoices/some-uuid` | `false` |
| `/api/stats` | `false` |
| `/` | `false` |
| `/rezerwacje` | `false` |
| `/login` | `true` |
| `/login/` | `true` |
| `/api/auth/login` | `true` |
| `/api/auth/logout` | `true` |
| `/api/health` | `true` |
| `/api/reservations/external` | `true` |
| `/_astro/chunk.abc123.js` | `true` |
| `/favicon.ico` | `true` |

**Block 2 — `authMiddleware` handler**: use a mock context factory and a
`next` stub (no server required):

```typescript
// Mock factory — plain object, no Astro classes needed
function makeCtx(pathname: string, user?: { id: string; email: string }) {
  return {
    url: { pathname },
    locals: { user },
    redirect: (url: string, status: number) =>
      new Response(null, { status, headers: { Location: url } }),
  } as unknown as Parameters<typeof authMiddleware>[0];
}
const next = async () => new Response("ok", { status: 200 });
```

Test cases:
- Unauthenticated GET `/api/invoices` → status 401, body
  `{"error":"Unauthorized"}`
- Unauthenticated GET `/api/stats` → status 401
- Unauthenticated GET `/faktury/nowy` → status 302, `Location` starts with
  `/login`
- Authenticated GET `/faktury/nowy` → status 200 (`next()` is called)
- Authenticated GET `/login` → status 302, `Location` is `/` (redirect away
  from auth page)
- Unauthenticated GET `/login` → status 200 (public page, `next()` called)

### Success Criteria

#### Automated Verification

- `npm run test` exits 0: all auth guard tests pass
- `npx tsc --noEmit` passes (new `export` is valid TypeScript)
- `npm run lint` passes

#### Manual Verification

- Test output names each M-1 route path in test descriptions (readable as
  contract, not just line numbers)
- Test output names each public route path in test descriptions

---

## Testing Strategy

### Unit Tests

- `isPublicPath` — 15 input/output assertions covering all three allowlists
  and all new M-1 routes
- `authMiddleware` — 6 mock-context cases covering both API (401) and page
  (302) unauthenticated branches, plus authenticated pass-through and
  authenticated auth-page redirect

### Integration Tests

None in this change. HTTP-level tests (running server) are deferred to later
rollout phases.

### Manual Testing Steps

1. Run `npm run test` — verify all tests pass and the output lists the route
   paths being asserted.
2. Temporarily remove the `/faktury/nowy` → `false` assertion and run again —
   verify the test fails. This confirms the test has real signal.
3. Revert the change and verify green again.

## References

- Risk #5 source: `context/foundation/test-plan.md` §2 and §3 Phase 1
- Research: `context/changes/testing-auth-guard/research.md`
- Auth middleware: `src/middleware/auth.ts`
- Middleware sequence: `src/middleware/index.ts:13`
- Path alias: `tsconfig.json:9`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Vitest Bootstrap

#### Automated

- [x] 1.1 `npm run test` exits 0 with one passing smoke test — 1b90a29
- [x] 1.2 `npm run lint` passes — 1b90a29
- [x] 1.3 `npm run build` passes — 1b90a29

#### Manual

- [x] 1.4 Terminal shows runner starting and one test passing — 1b90a29

### Phase 2: Auth Guard Tests

#### Automated

- [x] 2.1 `npm run test` exits 0 — all auth guard tests pass
- [x] 2.2 `npx tsc --noEmit` passes
- [x] 2.3 `npm run lint` passes

#### Manual

- [x] 2.4 Test output names M-1 route paths in test descriptions
- [x] 2.5 Test output names public routes in test descriptions
