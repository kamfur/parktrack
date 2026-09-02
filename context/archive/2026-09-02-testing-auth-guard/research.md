---
date: 2026-09-02T00:00:00Z
researcher: claude-sonnet-4-6
git_commit: 113faae92c7543825cdc41f9858019826b44f742
branch: main
repository: parktrack
topic: "Auth middleware coverage for new M-1 routes and Vitest setup for Astro SSR"
tags: [research, auth, middleware, vitest, testing, invoice, stats]
status: complete
last_updated: 2026-09-02
last_updated_by: claude-sonnet-4-6
---

# Research: Auth middleware coverage and Vitest setup for Astro SSR

**Date**: 2026-09-02
**Git Commit**: 113faae
**Branch**: main
**Repository**: parktrack

## Research Question

Ground rollout Phase 1 of `context/foundation/test-plan.md` (Risk #5).

Verify:
1. How the auth middleware works and which URL patterns it intercepts.
2. Whether new M-1 routes (`/faktury/*`, `/api/invoices`, `/api/stats`) are explicitly listed or implicitly protected.
3. What Vitest setup is needed for Astro SSR integration tests.
4. What existing patterns or utilities can be reused.

Risk response guidance to verify:
> Prove that each new M-1 route returns redirect or 401 for an unauthenticated request, not data. Verify the auth middleware explicitly covers these routes rather than assuming a catch-all. Anti-pattern: testing only the login page.

---

## Summary

The auth middleware uses an **explicit public-route allowlist**; everything not on the list is protected by default. All three new M-1 routes (`/faktury/*`, `/api/invoices`, `/api/stats`) fall under that catch-all and receive protection — but the protection is **implicit**, not explicit. No test today would catch a regression where one of these routes accidentally ends up on the public allowlist.

The `isPublicPath()` function in `src/middleware/auth.ts` is a **pure function** (takes a pathname string, returns bool). It is directly importable and testable with Vitest at zero integration cost. This is the cheapest test layer that gives a real signal for Risk #5 — far cheaper than spinning up a server.

Vitest setup for this project is straightforward: install `vitest`, configure path aliases, add `.env.test`. No test runner, no test files, and no CI pipeline exist today.

---

## Detailed Findings

### 1. Auth Middleware Architecture

**Files:** `src/middleware/index.ts`, `src/middleware/auth.ts`, `src/middleware/supabase.ts`

Middleware runs in a fixed sequence on every request:

```
supabaseMiddleware → authMiddleware → rateLimiter
```

`src/middleware/index.ts:13`:
```typescript
export const onRequest = sequence(supabaseMiddleware, authMiddleware, rateLimiter);
```

#### supabaseMiddleware (`src/middleware/supabase.ts:7-30`)

- Reads request cookies → creates Supabase SSR client via `createSupabaseServerClient(context.request, context.cookies)`
- Calls `supabase.auth.getUser()` to validate the session token stored in the cookie
- On success: sets `context.locals.user = { id, email }`
- On failure/exception: sets `context.locals.user = undefined` and **continues** (does not short-circuit) — authMiddleware handles the denial

#### authMiddleware (`src/middleware/auth.ts:1-58`)

**Strategy: explicit public-route allowlist.** Three arrays define what is public:

```typescript
// src/middleware/auth.ts:3-7
const PUBLIC_PAGE_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password", "/auth/callback"];
const PUBLIC_API_PREFIXES  = ["/api/auth/", "/api/health", "/api/reservations/external"];
const PUBLIC_ASSET_PREFIXES = ["/_astro/", "/favicon", "/sitemap"];
```

Matching logic (`src/middleware/auth.ts:9-23`): each prefix is checked as both an exact match and a prefix match (e.g., `/api/auth/` covers `/api/auth/login`, `/api/auth/logout`, etc.).

**Behavior when unauthenticated on a non-public path** (`src/middleware/auth.ts:44-52`):
- API routes (`/api/*`): return **401 JSON** `{"error": "Unauthorized"}`
- Page routes: return **302 redirect** to `/login?redirectTo={encoded original path}`

**Behavior when authenticated on a public auth page** (`src/middleware/auth.ts:39-40`): 302 redirect to `/`.

#### Session cookie mechanism

`src/db/supabase.server.ts:15-38` — `createSupabaseServerClient()` binds the Supabase SSR client (`@supabase/ssr`) to Astro's cookie API. Supabase automatically reads/writes an HTTP-only session cookie (`sb-{PROJECT_ID}-auth-token`) on every request. No manual cookie management is needed in application code.

---

### 2. New M-1 Route Protection Status

| Route | Explicitly listed? | Protected? | Handler checks `locals.user`? |
|---|---|---|---|
| `/faktury/nowy` | No | Yes (catch-all) | No — relies entirely on middleware |
| `/faktury/[id]/druk` | No | Yes (catch-all) | No — relies entirely on middleware |
| `/api/invoices` (GET, POST) | No | Yes (catch-all) | No — uses `locals.supabase`, not `locals.user` check |
| `/api/invoices/[id]` (GET) | No | Yes (catch-all) | No — relies entirely on middleware |
| `/api/stats` (GET) | No | Yes (catch-all) | **No** — uses `createSupabaseAdminClient()`, no user check at all |

**Key finding:** All new routes are currently protected, but the protection is **implicit via catch-all**. None of these routes appear in the allowlists. If the middleware allowlists were modified (e.g., someone adds `/api/` as a public prefix by mistake, or routes are restructured), protection would silently disappear. There is no test today that would catch this.

**Additional finding on `/api/stats`:** `src/pages/api/stats.ts` uses `createSupabaseAdminClient()` rather than `locals.supabase`. This means the handler does not validate the authenticated user at all — it relies 100% on middleware blocking unauthenticated requests before the handler runs. If the middleware were bypassed (e.g., during local development with middleware disabled), the stats endpoint would serve aggregate data without any auth check in the handler itself.

---

### 3. `isPublicPath()` — Directly Testable

`src/middleware/auth.ts:9-23` exports a **pure function** (no side effects, no I/O, no Astro context):

```typescript
function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return true;
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) return true;
  if (PUBLIC_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return false;
}
```

This function is currently **not exported**. Making it exported (or moving it to a separate testable module) is the prerequisite for the cheapest meaningful test of Risk #5.

**What to test on `isPublicPath`:**

| Pathname | Expected | Why it matters |
|---|---|---|
| `/faktury/nowy` | `false` | Invoice form must be protected |
| `/faktury/anything/druk` | `false` | Print view must be protected |
| `/api/invoices` | `false` | Invoice API must be protected |
| `/api/invoices/some-uuid` | `false` | Invoice GET must be protected |
| `/api/stats` | `false` | Stats API must be protected |
| `/login` | `true` | Auth pages must remain public |
| `/api/auth/login` | `true` | Auth API must remain public |
| `/api/reservations/external` | `true` | External booking API must stay public |
| `/_astro/chunk.js` | `true` | Assets must remain public |

**Anti-pattern avoided:** Testing that `/login` returns 200 (trivial) while leaving the downstream protected routes unverified.

---

### 4. `authMiddleware` Function — Integration Testable Without a Server

`src/middleware/auth.ts:34-56` exports `authMiddleware` as a standard `MiddlewareHandler`. It can be called directly in a test by constructing a minimal mock context object:

```typescript
// Shape of the mock context needed:
{
  url: { pathname: "/api/invoices" },
  locals: { user: undefined },          // undefined = unauthenticated
  redirect: (url, status) => Response.redirect(url, status)
}
```

The mock `next` function just returns a 200 response. This pattern lets us test the full middleware policy (redirect vs. 401 vs. allow) without a running Astro server.

**Important:** `authMiddleware` reads `context.locals.user` (set by `supabaseMiddleware`). For middleware unit tests, we provide this directly — we do not need to mock Supabase at this layer.

---

### 5. Vitest Setup Requirements

#### Current state (from `package.json` and filesystem scan)
- **No test runner installed** (`vitest`, `jest`, `playwright` — none present)
- **No test files** (zero `*.test.*` or `*.spec.*` files)
- **No test scripts** in `package.json`
- **No CI pipeline** (no `.github/workflows/`)

#### Required installs for Phase 1

```bash
npm install -D vitest @vitest/ui
```

That's sufficient for unit-level and middleware-function tests. No additional adapter or browser driver is needed for the auth guard tests.

#### `vitest.config.ts` requirements

Three things must be configured:
1. **Path alias** — `@/*` → `./src/*` (from `tsconfig.json:9`)
2. **Environment variables** — `import.meta.env` polyfill for `SUPABASE_URL`, `SUPABASE_KEY`, etc.
3. **Test environment** — `node` (not `jsdom`) for middleware/API logic that runs server-side

Minimal config:
```typescript
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    env: { /* or load from .env.test */ },
  },
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
});
```

#### Environment variables for tests

`src/db/supabase.server.ts:8-11` throws if `SUPABASE_URL` or `SUPABASE_KEY` are missing. Tests that import middleware code that transitively imports Supabase clients will need these set.

**Options (in order of preference for Phase 1):**
1. **`.env.test` with dummy values** — for tests that mock Supabase calls (sufficient for auth middleware tests, which don't actually call Supabase)
2. **Local Supabase** (`supabase start`) — for integration tests that need real DB queries (Phase 2/3)
3. **Separate Supabase test project** — for isolated integration tests against real infra

For Phase 1 auth guard tests, Option 1 is sufficient: `isPublicPath` and `authMiddleware` tests do not call Supabase at all.

#### `package.json` script to add
```json
"test": "vitest run",
"test:watch": "vitest"
```

---

### 6. Existing Patterns to Build On

- **Zod validation pattern** (`lessons.md`) — all API routes validate input with Zod before business logic. Test schemas can be reused directly.
- **Constructor injection in services** — `AuthService`, `InvoiceService`, `ReservationService` all accept a `SupabaseClient` via constructor. Service-level tests in Phase 2 can provide a mock client.
- **`createSupabaseAdminClient()` is nullable** (`src/lib/supabase-admin.ts:4`) — returns `null` when env vars missing. Tests can trigger this path intentionally (Phase 3, Risk #3).

---

## Code References

- `src/middleware/index.ts:13` — middleware sequence: `sequence(supabaseMiddleware, authMiddleware, rateLimiter)`
- `src/middleware/auth.ts:3` — `PUBLIC_PAGE_PREFIXES` allowlist
- `src/middleware/auth.ts:5` — `PUBLIC_API_PREFIXES` allowlist
- `src/middleware/auth.ts:7` — `PUBLIC_ASSET_PREFIXES` allowlist
- `src/middleware/auth.ts:9-23` — `isPublicPath()` pure function (not yet exported)
- `src/middleware/auth.ts:34-56` — `authMiddleware` handler
- `src/middleware/auth.ts:45-48` — API route 401 response
- `src/middleware/auth.ts:51-52` — page route 302 redirect
- `src/middleware/supabase.ts:7-30` — supabaseMiddleware: sets `locals.user` from cookies
- `src/db/supabase.server.ts:15-38` — `createSupabaseServerClient()`: cookie binding
- `src/lib/supabase-admin.ts:4-31` — `createSupabaseAdminClient()`: nullable, returns null if env missing
- `src/pages/api/stats.ts` — uses admin client, no `locals.user` check — middleware-only protection
- `src/pages/faktury/nowy.astro:2` — `prerender = false`, SSR, middleware-protected
- `src/pages/faktury/[id]/druk.astro:2` — `prerender = false`, SSR, middleware-protected
- `src/pages/api/invoices.ts:11` — `prerender = false`, middleware-protected
- `src/pages/api/invoices/[id].ts:5` — `prerender = false`, middleware-protected
- `tsconfig.json:9` — `@/*` path alias → `./src/*`
- `package.json:5-14` — scripts (no `test` script)
- `env.d.ts:8-14` — `App.Locals` shape: `supabase` + optional `user: { id, email, role? }`

---

## Architecture Insights

1. **Allowlist = safer than denylist for new routes.** New routes default to protected. The risk of accidentally exposing a route is lower than with a denylist approach. However, a test is still needed to document the expected protection explicitly and catch allowlist regressions.

2. **Two-layer protection for page routes, single-layer for API routes.** Page routes receive both a middleware redirect AND a server-side Supabase client that would fail without a session. API routes receive the 401 middleware response only — the handler code does not independently verify auth.

3. **`/api/stats` has zero auth at the handler level.** This is acceptable for aggregate data in a single-role app, but it means any middleware bypass (e.g., a test that calls the handler directly without going through middleware) would return data without auth validation. Tests for this route should test it through the middleware stack, not the handler in isolation.

4. **`isPublicPath()` is the single point of control.** All auth routing decisions flow through this function. A single export + a handful of unit tests covers the entire middleware policy for Risk #5.

---

## Historical Context

- **settings-configuration archive** — Established the `createSupabaseAdminClient()` pattern and the service-role-key dependency. Also documented the Railway env var gap (relevant to Phase 3, Risk #3).
- **invoice-generation archive** — Documents the two-layer guard pattern (Astro page redirect + `InvoiceService.ReservationNotCompletedError`). The Astro page guard is middleware-only; the service guard is independent. Auth tests and business-rule tests are distinct concerns.
- **statistic-dashboard archive** — Documents use of `createSupabaseAdminClient()` in the stats endpoint. Confirms that `/api/stats` deliberately uses the admin client (not `locals.supabase`) for aggregate queries.

---

## Open Questions

1. **Should `isPublicPath` be exported from `auth.ts`?** Currently unexported; exporting it (or moving it to a `src/lib/` utility) is the prerequisite for direct unit tests. The plan should make this a Phase 1 code change.

2. **Should `authMiddleware` be tested at the function level or via HTTP?** Function-level is cheaper and sufficient for Risk #5. HTTP-level gives broader coverage (cookie parsing, Supabase session validation, rate limiter) but needs a running server or more complex setup. Phase 1 can use function-level; later phases can add HTTP-level if needed.

3. **Test Supabase strategy for Phase 2 and beyond:** `supabase start` (local emulator) vs. a dedicated test project vs. mock client. Phase 1 avoids this question entirely. Phase 2 (InvoiceService tests) will need to resolve it — research should cover this in the Phase 2 research pass.
