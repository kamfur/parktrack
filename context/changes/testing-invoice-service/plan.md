# Invoice Service Correctness Tests — Implementation Plan

## Overview

Write unit and contract tests covering Risks #1, #2, #4, and #7 from
`context/foundation/test-plan.md` Phase 2. No server, no local Supabase required
— `InvoiceService` accepts constructor injection and is fully unit-testable with
vi.fn() stubs; the external API contract is testable via the Zod schema alone.

## Current State Analysis

Vitest is installed (Phase 1). One test file exists: `src/middleware/auth.test.ts`.
`InvoiceService` (`src/lib/services/invoice.service.ts`) exports `create()`, which:
1. Fetches the reservation and guards on `status === "completed"` (line 56).
2. Calls `getByReservationId()` to detect duplicates (line 59).
3. Queries settings and `auth.getUser()` in parallel (line 63–70).
4. Runs a MAX+1 seq query scoped to the current year+month (lines 97–107).
5. Inserts the invoice row with `total_amount: reservation.total_cost` (line 129).

The guard (line 56) is the **only** check on reservation status — the API handler at
`src/pages/api/invoices.ts:82–87` catches the resulting error and maps it to 422, but
performs no independent status check. No test currently catches a regression here.

`invoice_number` has a DB-level `UNIQUE` constraint (migration line 7). A concurrent
collision would produce a constraint violation error, not a silent duplicate — but
whether that error surfaces or is swallowed is currently untested.

The external endpoint is `POST /api/reservations/external` validated by
`createExternalReservationSchema`; its `201 { reservationId, message }` response shape
is typed as `CreateExternalReservationResponseDto`. Both are importable and testable
without a server.

## Desired End State

`npm run test` passes with:
- `src/lib/services/invoice.service.test.ts` — ~6 tests covering Risks #1, #2, #4
- `src/lib/schemas/reservation.schema.test.ts` — ~7 tests covering Risk #7
- `context/foundation/test-plan.md` §6.1 and §6.4 filled with the patterns established here

### Key Discoveries

- `src/lib/services/invoice.service.ts:129` — `total_amount: reservation.total_cost` reads
  the stored value; no recalculation. Unit-testable with a mock returning `total_cost: 250`.
- `src/lib/services/invoice.service.ts:56` — completed-only guard; throws
  `ReservationNotCompletedError`. Function exits before any other query, so the mock for
  the non-completed tests only needs to stub `from("reservations")`.
- `src/lib/services/invoice.service.ts:137` — `if (insertError) throw new Error(...)` —
  DB constraint errors propagate as thrown `Error`, not silent success. Testable by mocking
  the insert to return `{ data: null, error: { message: '...' } }`.
- `src/lib/services/invoice.service.ts:25–26` — constructor injection:
  `constructor(private readonly supabase: SupabaseClient)`. Tests instantiate the service
  directly with a mock supabase object.
- `src/lib/services/invoice.service.ts:59` — `getByReservationId()` is a public method.
  For Risk #1 and Risk #4 tests, spy on it with `vi.spyOn(service, 'getByReservationId')`
  to return `null`, which eliminates one `from("invoices")` call from the mock surface.
- `src/lib/schemas/reservation.schema.ts:7–27` — `createExternalReservationSchema` is
  directly importable. Seven required fields; `checkOutDate` must be after `checkInDate`.
- `src/types.ts` — `CreateExternalReservationResponseDto` is a named TypeScript interface.
  A compile-time assignment assertion (`const _check: Type = literal`) proves the shape
  without a runtime test.

## What We're NOT Doing

- No HTTP-level integration tests (no running Astro server)
- No local Supabase instance (all DB interactions mocked via vi.fn() stubs)
- No tests for `supabaseMiddleware`, `rateLimiter`, or the staff-facing `POST /api/reservations`
- No test for the actual DB concurrency race in Risk #4 (requires a real DB; the advisory
  lock is deferred to M-2 by design — the test proves error surfacing, not uniqueness)
- No test for `POST /api/invoices` handler directly (the service-layer guard IS the
  protection; handler mapping is covered by the error type + 422 status in the handler code)

## Implementation Approach

**Phase 1** unit-tests `InvoiceService` with vi.fn() stubs. The mock supabase object
needs a `from(table)` method that returns a chainable query builder resolving to
different values per table. For Risk #2 tests the mock is minimal (only the reservation
fetch runs before the function throws). For Risk #1 and Risk #4, `getByReservationId`
is spied on to null-return, and the remaining mock surface is: reservations fetch, 5
settings fetches, `auth.getUser()`, the seq query, and the insert.

**Phase 2** imports `createExternalReservationSchema` directly and asserts validation
outcomes against a hardcoded golden payload. A TypeScript compile-time assertion covers
the response DTO shape.

**Phase 3** updates `context/foundation/test-plan.md` §6.1 (unit test pattern) and §6.4
(invoice business rule pattern) with the conventions established in phases 1–2.

## Critical Implementation Details

**Mock supabase `from()` handles multiple calls:** `InvoiceService.create()` calls
`from("invoices")` three times (duplicate check via `getByReservationId`, seq query,
insert). Spy on `getByReservationId` to eliminate the first call. The remaining two
`from("invoices")` calls have different chain signatures (seq uses `.select("invoice_seq")`
then `.order().limit().maybeSingle()`; insert uses `.insert().select().single()`), so
the mock builder can distinguish them by tracking call count on the `from` mock for the
`"invoices"` table, or by returning a builder whose terminal method (`.maybeSingle()` vs
`.single()`) is independently configured via a closure captured in `makeFrom`.

**`supabase.auth.getUser()` must be mocked:** line 69 calls `this.supabase.auth.getUser()`.
The mock supabase object must include `auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) }`.

**Risk #4 constraint violation shape:** the Supabase JS client returns
`{ data: null, error: { message: '...', code: '23505' } }` for a unique-constraint
violation. The mock insert should return this shape. The service at line 137 checks
`if (insertError) throw new Error(insertError.message)` — assert the thrown error
message contains the constraint description.

---

## Phase 1: InvoiceService Unit Tests

### Overview

Create `src/lib/services/invoice.service.test.ts` with ~6 tests covering:
- Risk #1: `total_amount` reads `reservation.total_cost` (not a recalculation)
- Risk #2: all four non-completed statuses throw `ReservationNotCompletedError`
- Risk #4: a unique-constraint insert error surfaces as a thrown `Error` (not silently swallowed)

### Changes Required

#### 1. Create invoice.service.test.ts

**File**: `src/lib/services/invoice.service.test.ts`

**Intent**: Provide executable documentation that `InvoiceService.create()` enforces
the three key invariants: total passthrough, completed-only guard, and fail-loud on collision.

**Contract**: Three `describe` blocks, one per risk. Each test instantiates
`new InvoiceService(mockSupabase)` directly.

The mock supabase factory must expose:
- `from(table)` → returns a builder with `.select().eq().maybeSingle()` / `.order().limit().maybeSingle()` / `.insert().select().single()` chains, each resolving to a value configured per test
- `auth.getUser()` → resolves `{ data: { user: { id: "user-1" } }, error: null }` for Risk #1 and Risk #4 tests

**Risk #2 mock** (minimal — function throws before reaching any invoice query):
Configure `from("reservations")...maybeSingle()` to resolve with the target reservation
(e.g. `{ data: { id: "r-1", status: "confirmed", total_cost: 100, ... }, error: null }`).
No other calls will run.

**Risk #1 test**: spy on `service.getByReservationId` to return `null`; configure
`from("reservations")` to return `{ status: "completed", total_cost: 250, planned_check_in: "2026-09-01T10:00:00Z", planned_check_out: "2026-09-02T10:00:00Z", actual_check_in: null, actual_check_out: null, ... }`; configure all `from("settings")` calls to return `{ data: { value: "dummy" } }`; configure seq query to return `{ data: null }`; configure insert to return a row with `total_amount: 250`. Assert `result.total_amount === 250`.

**Risk #4 test**: same setup as Risk #1 but configure the insert chain `.single()` to
resolve `{ data: null, error: { message: 'duplicate key value violates unique constraint "invoices_invoice_number_key"', code: '23505' } }`. Assert that `service.create(cmd)` rejects and that the thrown error message includes "duplicate".

### Success Criteria

#### Automated Verification

- `npm run test` exits 0 — all InvoiceService tests pass
- `npm run lint` passes on the new test file

#### Manual Verification

- Test output names each risk explicitly in describe/it descriptions (e.g. "throws ReservationNotCompletedError for status: in_progress")
- Temporarily change line 56 of invoice.service.ts from `!== "completed"` to `!== "cancelled"` and confirm the Risk #2 tests for `confirmed`, `in_progress`, and `no_show` all fail

---

## Phase 2: External API Schema Contract Test

### Overview

Create `src/lib/schemas/reservation.schema.test.ts` asserting the external reservation
API's accepted payload and response shape are pinned. Future changes to the schema that
would break external consumers will fail this test.

### Changes Required

#### 1. Create reservation.schema.test.ts

**File**: `src/lib/schemas/reservation.schema.test.ts`

**Intent**: Pin the external API's accepted payload contract (Risk #7). A hardcoded
"golden payload" proves the current expected input; negative cases prove each required
field is individually enforced. A compile-time DTO assertion proves the response shape.

**Contract**: Two `describe` blocks.

**Block 1 — `createExternalReservationSchema`**:
- Import `createExternalReservationSchema` from `@/lib/schemas/reservation.schema`
- Import `CreateExternalReservationResponseDto` from `@/types`
- Golden payload: `{ lastName: "Kowalski", firstName: "Jan", email: "jan@example.com", phone: "123456789", licensePlate: "WA12345", checkInDate: "2026-09-10T14:00:00.000Z", checkOutDate: "2026-09-12T12:00:00.000Z" }` — assert `schema.safeParse(payload).success === true`
- Negative cases (one `it` each): missing `lastName`, missing `firstName`, missing `email`, invalid email format, missing `phone`, missing `licensePlate`, `checkOutDate` before `checkInDate` — each asserts `safeParse(...).success === false`

**Block 2 — `CreateExternalReservationResponseDto` shape (compile-time)**:
- Assign a literal `{ reservationId: "r-1", message: "ok" }` to a variable typed as `CreateExternalReservationResponseDto`. If the interface ever loses a field or changes a type, the test file will fail TypeScript compilation, surfacing as a lint/build failure before any test runs.

### Success Criteria

#### Automated Verification

- `npm run test` exits 0 — all schema contract tests pass
- `npm run lint` passes on the new test file

#### Manual Verification

- Test output names each external API field explicitly in test descriptions
- Temporarily remove `phone` from `createExternalReservationSchema` and confirm the "rejects when phone is missing" test fails

---

## Phase 3: Cookbook Update

### Overview

Fill in `context/foundation/test-plan.md` §6.1 (unit test pattern) and §6.4 (invoice
business rule pattern) with the conventions established in phases 1–2. Future
contributors and `/10x-tdd` read this section to know how to add new tests.

### Changes Required

#### 1. Update §6.1 — Adding a unit test

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the `TBD` placeholder in §6.1 with the actual pattern used in phases 1–2.

**Contract**: Replace the §6.1 body with:
- Location: colocated with source, same directory, `.test.ts` suffix (e.g. `src/lib/services/foo.service.test.ts`)
- Naming: `describe("ClassName", () => { describe("methodName() — risk description", ...) })`
- Mock pattern: `new Service(mockSupabase)` via constructor injection; vi.fn() per-call stubs on the supabase query chain
- Run command: `npm run test`
- Reference test: `src/lib/services/invoice.service.test.ts`

#### 2. Update §6.4 — Adding a test for invoice business rules

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the `TBD` placeholder in §6.4 with the pattern for testing invoice
business rules against a mock supabase client.

**Contract**: Replace the §6.4 body with:
- Seed a completed reservation in the mock: `{ id: "r-uuid", status: "completed", total_cost: <value> }`
- Spy on `service.getByReservationId` to return `null` (no duplicate)
- Stub all `from("settings")` chains and `auth.getUser()` with dummy values
- Call `service.create(cmd)` and assert the result
- Reference test: `src/lib/services/invoice.service.test.ts`

### Success Criteria

#### Automated Verification

- `npm run lint` passes (markdown formatting is clean)

#### Manual Verification

- §6.1 and §6.4 in test-plan.md no longer read "TBD"; they contain actionable patterns

---

## Testing Strategy

### Unit Tests

- `InvoiceService.create()` — 6 tests: 1 total_amount passthrough, 4 status guards, 1 collision error surfacing
- `createExternalReservationSchema` — 7 tests: 1 golden payload, 6 negative cases

### Manual Testing Steps

1. Run `npm run test` — all 13 tests pass.
2. Mutate `invoice.service.ts:56` to change the guard condition, confirm Risk #2 tests fail.
3. Mutate `reservation.schema.ts` to remove a required field, confirm the matching negative test fails.
4. Revert both mutations and confirm green.

## References

- Risk #1–2–4–7 source: `context/foundation/test-plan.md` §2–§3
- InvoiceService: `src/lib/services/invoice.service.ts`
- API handler: `src/pages/api/invoices.ts`
- External endpoint: `src/pages/api/reservations/external.ts`
- Schema: `src/lib/schemas/reservation.schema.ts`
- Types: `src/types.ts`
- DB migration: `supabase/migrations/20260901120000_add_invoices_and_seller_settings.sql`
- Prior archive: `context/archive/2026-09-01-invoice-generation/plan.md`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: InvoiceService Unit Tests

#### Automated

- [x] 1.1 `npm run test` exits 0 — all InvoiceService tests pass — 4e12608
- [x] 1.2 `npm run lint` passes on invoice.service.test.ts — 4e12608

#### Manual

- [x] 1.3 Test output names each risk and status in test descriptions — 4e12608
- [x] 1.4 Mutation check: guard regression causes Risk #2 tests to fail — 4e12608

### Phase 2: External API Schema Contract Test

#### Automated

- [x] 2.1 `npm run test` exits 0 — all schema contract tests pass — 2b9a242
- [x] 2.2 `npm run lint` passes on reservation.schema.test.ts — 2b9a242

#### Manual

- [x] 2.3 Test output names each external API field — 2b9a242
- [x] 2.4 Mutation check: removing a schema field causes the matching test to fail — 2b9a242

### Phase 3: Cookbook Update

#### Automated

- [x] 3.1 `npm run lint` passes on test-plan.md

#### Manual

- [x] 3.2 §6.1 and §6.4 are no longer TBD — contain actionable patterns
