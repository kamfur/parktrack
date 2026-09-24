# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-09-01

---

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   team is worried about X, and the failure would surface somewhere in
   <area>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/` (9 commits / 30 d).
Top churn directories: `src/components/dashboard` (5), `src/pages/api` (4),
`src/lib/schemas` (4), `src/pages/api/auth` (3), `src/middleware` (3).

---

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | Staff receives an invoice whose total differs from what the customer actually paid — the cost stored on the reservation diverges from what the invoice records | High | Medium | Interview Q1; PRD §Business Logic (billing rule); invoice-generation archive |
| 2 | An invoice is created for a reservation that is not `completed` — the API-level guard is bypassed while the page-level guard appears intact, or vice versa | High | Medium | PRD US-01 AC; invoice-generation archive (two-layer guard) |
| 3 | Settings write fails with a visible 503 when the service role key is absent — if the null check is removed in a future refactor, PATCH reverts to a crash or silent success; the SSR page read still fails silently (renders hardcoded defaults) with no user warning | High | Medium | Interview Q3; settings-configuration archive; stack-assessment Gap 1 |
| 4 | Two near-simultaneous invoice creations in the same calendar month produce the same invoice number — the MAX+1 pattern has no advisory lock; the DB constraint either catches it with a clear error or is absent | High | Low | PRD FR-011; invoice-generation archive (noted "deferred to M-2") |
| 5 | Unauthenticated request reaches a protected route (`/faktury/*`, `/api/invoices`, `/api/stats`) after auth middleware regression — new M-1 routes may not be covered by the catch-all | High | Medium | hot-spot `src/middleware` (3 commits/30d); hot-spot `src/pages/api/auth` (3 commits/30d); tech-stack (`has_auth: true`) |
| 6 | Revenue stats display the wrong month total at month-end — the Warsaw timezone clause is dropped in a future stats query touch, shifting the month boundary by 1–2 hours | Medium | Low | statistic-dashboard archive (Warsaw timezone boundary); hot-spot `src/pages/api` (4 commits/30d) |
| 7 | The external reservation creation API breaks for existing consumers — a future change to the handler or response shape is not obviously a breaking change from the inside | High | Low | PRD §Constraints ("external API must not break"); PRD preserved capabilities |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| #1 | Invoice `total_amount` on the persisted row equals the `total_cost` stored on the reservation; no code path produces a divergent total | "If `total_cost` exists the invoice will show it" — verify the service reads the stored value, not recomputes | How `InvoiceService.create()` derives `total_amount`; whether it reads `total_cost` from the reservation or recalculates from `days × rate` | Unit test on `InvoiceService` | Asserting the expected value by reading the implementation (oracle problem — tautological test) |
| #2 | `POST /api/invoices` with a `confirmed` or `in_progress` reservation returns a 4xx; only `completed` passes | "The Astro page redirect is the guard" — must verify the API endpoint enforces the rule independently, since the page can be bypassed by direct API call | How the API route validates reservation status before delegating to the service; whether the service check is reachable without the page guard | Integration test on the API route | Testing only the happy path (completed → invoice created) without exercising non-completed statuses |
| #3 | PATCH to settings with the service role key absent surfaces a non-200 response or explicit error message — not a silent 200 that stores nothing | "If the admin client is configured, writes work" — test the missing-key code path explicitly, not just the happy path | How `createSupabaseAdminClient()` behaves when the env var is undefined; whether the API handler propagates or swallows that error | Integration test with the env var unset | Testing only when the key IS present (that passes trivially; gives no signal about the failure mode) |
| #4 | Two parallel invoice creation requests in the same month either produce unique invoice numbers, or one fails with a clear DB constraint error — no silent duplicate | "Single-user MVP means no concurrency risk" — even two browser tabs opening the form simultaneously can race | Whether `invoice_number` carries a DB-level UNIQUE constraint; whether the application layer surfaces a constraint error cleanly | Integration test: two near-simultaneous inserts, assert uniqueness or explicit error | Testing only sequential single-request numbering (gives no signal about the race) |
| #5 | An unauthenticated GET/POST to each new M-1 route (`/faktury/*`, `/api/invoices`, `/api/stats`) returns redirect or 401 — not data | "Middleware runs on all routes" — verify the new routes are explicitly covered, not assumed via a catch-all that may miss them | Which URL patterns the auth middleware intercepts; whether `/faktury/*` and new API routes are in scope or fall through | Integration test per protected route, no session cookie | Testing only the login page itself, leaving the downstream protected routes unverified |
| #6 | A reservation at 23:00 UTC on the last calendar day of a month (01:00 Warsaw = first day of next month) is counted in the correct Warsaw-timezone month | "Warsaw timezone in the column name means the boundary is correct" — verify with a concrete boundary timestamp against seeded data | The exact field and timezone expression used in the stats month-period query; whether `planned_check_in` or `actual_check_in` is the bucket field | Integration test with a seeded reservation at the UTC/Warsaw month boundary | Asserting "revenue > 0" without specifying the month or the boundary timestamp |
| #7 | A hardcoded external-consumer POST payload (the contract fields an external system would send today) produces the expected status and response shape | "We didn't touch the reservations API so it's still compatible" — future changes to shared types can break the response shape without looking like a breaking change | The current `POST /api/reservations` accepted payload and the response fields an external consumer depends on | Contract test: fixed payload, assert response field presence and types | Testing only internal code paths without a fixed external contract document as the oracle |

---

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Test runner bootstrap + auth guard | Install Vitest and prove auth middleware covers all new M-1 routes | #5 | integration | complete | context/archive/2026-09-02-testing-auth-guard |
| 2 | Invoice service correctness | Prove invoice total accuracy, completed-only guard, numbering integrity, and external API contract | #1, #2, #4, #7 | unit + integration | complete | context/archive/2026-09-02-testing-invoice-service |
| 3 | Settings admin client + stats correctness | Prove settings write failure surfaces visibly and Warsaw timezone boundary is enforced | #3, #6 | integration | complete | context/archive/2026-09-02-testing-settings-stats |
| 4 | Quality gates wiring | Wire `npm run test`, lint, and build into a GitHub Actions CI workflow on every PR | cross-cutting | CI config | complete | context/archive/2026-09-03-testing-quality-gates |

**Status vocabulary** (parser literals — do not rename):
`not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`

---

## 4. Stack

The classic test base for this project. No test runner exists yet — Phase 1
bootstraps it.

| Layer | Tool | Notes |
|---|---|---|
| unit + integration | Vitest | none yet — see §3 Phase 1 |
| DB/API test client | Supabase JS client (test env) or in-process mock | none yet — see §3 Phase 1; research must verify which approach fits the Astro SSR architecture |
| e2e | none | not in rollout scope for M-1; re-evaluate at `--refresh` |
| accessibility | none | not in rollout scope for M-1 |

**Stack grounding tools (current session):**
- Docs: none — not available in current session; Vitest official docs (vitest.dev) and Astro testing guide (docs.astro.build) to be consulted during Phase 1 research; checked: 2026-09-01
- Search: none — not available in current session; checked: 2026-09-01
- Runtime/browser: none — not available in current session; checked: 2026-09-01
- Provider/platform: none — not available in current session; Supabase local emulator or test project to be evaluated during Phase 1 research; checked: 2026-09-01

---

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase N" means the gate is enforced once that rollout
phase ships.

| Gate | Where | Required? | Catches |
|---|---|---|---|
| lint + typecheck | local + CI (after Phase 4) | required now (local); required in CI after §3 Phase 4 | syntactic and type drift |
| unit + integration | local + CI | required after §3 Phase 1 | business logic regressions, API guard regressions |
| e2e on critical flows | — | not in scope for M-1 | — |
| post-edit hook | local (agent loop) | recommended after §3 Phase 1 | regressions surfaced at edit time, before commit |
| CI build + test | GitHub Actions on PR | required after §3 Phase 4 | broken builds, failing tests reaching the repo |

---

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section fills in once the
relevant rollout phase ships.

### 6.1 Adding a unit test (e.g., a service method)

- **Location**: colocated with source, same directory, `.test.ts` suffix — e.g., `src/lib/services/foo.service.test.ts` next to `foo.service.ts`.
- **Naming**: `describe("ClassName", () => { describe("methodName() — risk description", () => { it("...", ...) }) })`.
- **Mock pattern**: pass a mock supabase object via constructor injection — `new FooService(mockSupabase as unknown as SupabaseClient)`. Build per-call vi.fn() stubs on the query chain (`.select().eq().maybeSingle()` etc.) using `vi.fn().mockReturnThis()` for chainable methods and `vi.fn().mockResolvedValue(result)` for terminal methods. Use `vi.spyOn(service, 'publicMethod')` to bypass internal calls that would expand the mock surface unnecessarily.
- **Run command**: `npm run test`
- **Reference test**: `src/lib/services/invoice.service.test.ts`

### 6.2 Adding an integration test for an API route

TBD — see §3 Phase 1. Will cover: how to start the Astro server in test mode (or mock the handler), session/cookie setup, DB seeding approach, and reference test.

### 6.3 Adding a test for a new auth-protected route

TBD — see §3 Phase 1. Will cover: the pattern for asserting redirect/401 without a valid session, and the pattern for asserting data is served with a valid session.

### 6.4 Adding a test for invoice business rules

- **Seed a completed reservation** in the mock: `{ id: "r-uuid", status: "completed", total_cost: <value>, planned_check_in: "...", planned_check_out: "...", actual_check_in: null, actual_check_out: null }`. Use a hardcoded literal for `total_cost` — never derive it from the service implementation (oracle problem).
- **Spy on `getByReservationId`** to return `null` (no duplicate): `vi.spyOn(service, "getByReservationId").mockResolvedValue(null)`. This eliminates one `from("invoices")` call from the mock surface; the two remaining calls (seq query → `.maybeSingle()`, insert → `.single()`) are distinguishable by terminal method and call order.
- **Stub all `from("settings")` chains** with `{ data: { value: "dummy" }, error: null }` and stub `auth.getUser()` with `{ data: { user: { id: "user-1" } }, error: null }`.
- **Call `service.create(cmd)`** and assert the result field (e.g., `result.total_amount === 250`).
- **Reference test**: `src/lib/services/invoice.service.test.ts`

### 6.5 Adding a settings or stats integration test

#### Admin-client guard test

Use when you need to assert that a handler returns 503 (not a silent success) when
`createSupabaseAdminClient()` returns null.

- **Mock the module** at the top of the test file (before any imports that depend on it):
  `vi.mock("../../lib/supabase-admin", () => ({ createSupabaseAdminClient: vi.fn() }))`.
  Vitest hoists `vi.mock` calls — place the import of the mocked module *after* the `vi.mock` line.
- **Return null in `beforeEach`**: `vi.mocked(createSupabaseAdminClient).mockReturnValue(null)`.
- **Construct a minimal context** matching the handler's destructured parameters (e.g., `{ url, request }` for PATCH). Cast with `as unknown as Parameters<typeof PATCH>[0]`.
- **Assert `res.status === 503`** and that `res.json().error` mentions `SUPABASE_SERVICE_ROLE_KEY`.
- **Reference test**: `src/pages/api/settings.test.ts`

#### Timezone boundary test

Use when you need to assert that `getWarsawPeriodBounds()` emits the correct Warsaw UTC offset
and month-start strings.

- **Export the function** (it must carry the `export` keyword in `stats.ts` — see Phase 1 of this change).
- **Freeze time**: `vi.useFakeTimers(); vi.setSystemTime(new Date("YYYY-MM-DDTHH:MM:SSZ"))`.
  Pass a UTC instant whose Warsaw-local date/offset you know (e.g. `"2026-08-15T10:00:00Z"` = Aug 15 12:00 CEST, offset +02:00).
- **Call `getWarsawPeriodBounds("month")`** and assert the full ISO 8601 string including offset suffix (e.g. `"2026-08-01T00:00:00+02:00"`). Asserting the full string catches a regression that strips the `${tz}` suffix.
- **Restore timers in `afterEach`**: `vi.useRealTimers()` — prevents bleed between test cases.
- **Reference test**: `src/pages/api/stats.test.ts`

---

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Print layout formatting** — too brittle to assert automatically; the layout is validated visually by staff before printing. Re-evaluate if the print template becomes programmatically generated. (Source: interview Q5.)
- **Shadcn/ui components in `src/components/ui/`** — vendored; the component library is the test. Re-evaluate if the project forks or patches these components. (Source: project convention — do not hand-edit.)
- **NIP format validation** — explicitly out of scope in PRD v1; staff is responsible for accuracy of customer billing data. Re-evaluate if GUS/VIES API integration is added. (Source: PRD §Non-Goals.)

---

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-09-01
- Stack versions last verified: 2026-09-01
- AI-native tool references last verified: n/a (none in this rollout)

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
