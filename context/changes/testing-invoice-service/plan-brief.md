# Plan Brief: Invoice Service Correctness Tests

## What & Why

Phase 2 of the test rollout. Prove four critical invariants before any regression can hide:

- **Risk #1** — `total_amount` passes through `reservation.total_cost` unchanged (no recalculation)
- **Risk #2** — non-completed reservations are rejected at the service layer, not just the handler
- **Risk #4** — a unique-constraint collision surfaces as a thrown error (not silently swallowed)
- **Risk #7** — the external reservation API's accepted payload contract is pinned

No server, no local Supabase. `InvoiceService` accepts constructor injection; the external API schema is a pure Zod import.

## Starting Point

- `src/lib/services/invoice.service.ts` — `InvoiceService.create()` with constructor injection at line 25–26
- `src/lib/schemas/reservation.schema.ts` — `createExternalReservationSchema` (7 required fields)
- `src/types.ts` — `CreateExternalReservationResponseDto`
- Vitest configured; one test file exists (`src/middleware/auth.test.ts`)

## Desired End State

`npm run test` passes with:
- `src/lib/services/invoice.service.test.ts` — 6 tests (Risks #1, #2, #4)
- `src/lib/schemas/reservation.schema.test.ts` — 7 tests (Risk #7)
- `context/foundation/test-plan.md` §6.1 and §6.4 filled with established patterns

## Key Decisions

| Question | Decision | Rationale |
|---|---|---|
| Mock strategy | vi.fn() per-call stubs on constructor-injected supabase | No extra library; supabase is injected, not imported |
| Risk #2 layer | InvoiceService unit test | Guard is in service, not handler |
| Risk #4 scope | Mock constraint violation, assert error surfaces | Real DB race needs advisory lock (M-2 deferred) |
| Risk #7 layer | Zod schema contract test (pure, no server) | Schema is directly importable |
| Status coverage | All 4 non-completed statuses | Full coverage: confirmed, in_progress, cancelled, no_show |
| File layout | Colocated, two test files | Mirrors established auth.test.ts convention |
| Oracle guard | Hardcoded `total_cost: 250` literal | Any recalculation logic would break the assertion |

## Phases at a Glance

| Phase | Deliverable | Key work |
|---|---|---|
| 1 | `invoice.service.test.ts` | 6 tests via vi.fn() mock supabase |
| 2 | `reservation.schema.test.ts` | 7 tests: golden payload + 6 negatives + DTO compile check |
| 3 | `test-plan.md` §6.1 + §6.4 | Replace TBD placeholders with established patterns |

## Success Criteria

- `npm run test` exits 0 (13 tests pass)
- `npm run lint` passes on both new test files
- Mutation of `invoice.service.ts:56` guard causes Risk #2 tests to fail
- Removing a field from `createExternalReservationSchema` causes matching negative test to fail
