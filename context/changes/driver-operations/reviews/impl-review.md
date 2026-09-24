<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Driver Operations — Implementation Plan

- **Plan**: context/changes/driver-operations/plan.md
- **Scope**: Phases 1–4 of 4 (code landed; Manual 3.2, 3.3, 4.3 still open)
- **Date**: 2026-09-09
- **Verdict**: REJECTED
- **Findings**: 1 critical, 5 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Driver UPDATE trigger is a denylist; `total_cost` is writable

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260909140000_harden_rls_by_app_role.sql:75-90
- **Detail**: Plan required driver UPDATE limited to allowed columns/statuses. The trigger blocks identity columns (`last_name`, `email`, `planned_check_in`, …) but not `total_cost`, `is_paid`, or `notes`. A driver JWT talking to PostgREST can change billed cost without going through Zod/`DriverService`. App PATCH routes *do* Zod-validate bodies (arrival.ts:42). `surcharge_amount` has no DB check constraint.
- **Fix A ⭐ Recommended**: Switch the trigger to an allowlist of operational columns per status (arrival vs departure fields + `status`/`actual_*`/`updated_at`/`total_cost` only when the cost trigger recalculates from dates).
  - Strength: Matches the plan’s “allowed columns” contract and closes the PostgREST bypass.
  - Tradeoff: Must keep `trg_update_cost` in mind if `planned_check_out` stays driver-writable.
  - Confidence: HIGH — denylist vs allowlist is explicit in the trigger body.
  - Blind spot: Haven’t applied the migration against a live project to confirm trigger order with `trg_update_cost`.
- **Fix B**: Keep denylist; add `total_cost` (and any other money columns) to the blocked set.
  - Strength: Small patch; stops the worst money-integrity hole.
  - Tradeoff: Future columns stay writable until someone remembers to extend the list.
  - Confidence: HIGH — one more `is distinct from` clause.
  - Blind spot: `is_paid` still driver-settable (may be intended).
- **Decision**: FIXED via Fix A — migration `20260909180000_driver_reservation_update_allowlist.sql` (identity denylist + freeze `total_cost` for `trg_update_cost`).

### F2 — Driver SELECT is all reservation rows, not operational-only

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: supabase/migrations/20260909140000_harden_rls_by_app_role.sql:113-116
- **Detail**: Plan: “Drivers: SELECT operational rows”. Policy `Drivers can select reservations` is `using (is_driver_role())` with no status/window filter. Drivers can read completed/cancelled history and all PII columns via PostgREST even though `DriverService` projects a subset.
- **Fix A ⭐ Recommended**: Restrict SELECT to `status in ('confirmed','in_progress')` (occupancy + lists).
  - Strength: Closest to “operational rows”; still covers Phase 2/3 UI.
  - Tradeoff: Drivers lose historical lookup unless a later change adds it.
  - Confidence: HIGH — matches occupancy + arrival/departure statuses.
  - Blind spot: Whether field ops need to look up a just-completed car.
- **Fix B**: Keep full SELECT; document as addendum (defense-in-depth vs previous `authenticated + true`).
  - Strength: No extra round-trip for “where is that plate from yesterday”.
  - Tradeoff: PII of cancelled/completed stays on every driver JWT.
  - Confidence: MEDIUM — product call, not a code constraint.
  - Blind spot: Legal/PII expectations for driver tablets.
- **Decision**: FIXED via Fix A — driver SELECT limited to `confirmed`/`in_progress` in `20260909180000_driver_reservation_update_allowlist.sql`.

### F3 — Missing JWT role still means full staff access

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/lib/auth/resolve-app-role.ts:10
- **Detail**: Locked plan: missing `app_metadata.role` defaults to `staff` so existing accounts keep access. `is_staff_role()` is “not driver”, so unknown roles are staff too. That matches the plan and brownfield, but any authenticated user without an explicit driver claim gets invoices/settings RLS. `/register` is a public prefix; there is no `src/pages/register` page in-tree, so self-signup may be unused — still a fail-open default.
- **Fix A ⭐ Recommended**: Keep default-staff for this v1 (plan lock); require `app_metadata.role` on every production user and treat unknown as deny in a follow-up.
  - Strength: Does not lock out current staff overnight.
  - Tradeoff: Fail-open remains until ops hygiene is proven.
  - Confidence: HIGH — matches Migration Notes in the plan.
  - Blind spot: Whether production signup is enabled on the Supabase project.
- **Fix B**: Default unknown/missing to no staff RLS (deny) and backfill `staff` on known users.
  - Strength: Least privilege; new accounts cannot administer the lot.
  - Tradeoff: Anyone missing the claim loses dashboard until backfill.
  - Confidence: MEDIUM — depends on how users were created historically.
  - Blind spot: Count of users without `app_metadata.role`.
- **Decision**: FIXED via Fix A — documented in plan addendum + AGENTS.md; code default unchanged.

### F4 — Driver writes never set `last_modified_by`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/driver.service.ts:92-104
- **Detail**: Arrival/departure updates omit `last_modified_by`. The RLS trigger forbids drivers from changing that column, so even a client-side fix would fail. Audit stays on the previous editor (often staff/system).
- **Fix**: Trusted BEFORE UPDATE trigger: if `is_driver_role()` then `new.last_modified_by = auth.uid()` (and drop that column from the denylist).
- **Decision**: FIXED — `new.last_modified_by := auth.uid()` in `20260909180000_driver_reservation_update_allowlist.sql`.

### F5 — Dopłata is not included in invoice `total_amount`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/lib/services/invoice.service.ts:129
- **Detail**: Plan stores `surcharge_amount` on the reservation and says no invoice UI for drivers. Staff invoices still snapshot `reservation.total_cost` only. Extending stay via `planned_check_out` also recalculates `total_cost` (`trg_update_cost`), so dopłata can be omitted, or duration can be double-counted if both change.
- **Fix A ⭐ Recommended**: Document the v1 rule (invoice = `total_cost` only; surcharge is operational cash) in plan addendum / AGENTS.md.
  - Strength: Matches “no invoice generation UI” for drivers; no staff invoice rewrite in this change.
  - Tradeoff: Staff invoices can under-bill dopłata.
  - Confidence: MEDIUM — product, not coded.
  - Blind spot: How cashiers record dopłata today.
- **Fix B**: Invoice `total_cost + coalesce(surcharge_amount,0)` (or fold surcharge into `total_cost` on departure).
  - Strength: One number for accounting.
  - Tradeoff: Touches staff invoice path (scope).
  - Confidence: MEDIUM — needs a single financial definition and a test.
  - Blind spot: Existing invoices already issued.
- **Decision**: FIXED via Fix A — plan addendum: invoices stay `total_cost`; surcharge is operational cash.

### F6 — Driver lists are unbounded and poll can overlap

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/driver.service.ts:35-72; src/hooks/useDriverOps.ts:71-73
- **Detail**: Plan: overdue stays until closed; lists should stay cheap. Queries have no `limit`. `useDriverOps` refetches all three lists every 60s without aborting in-flight requests. Fine for a small lot; grows with stale overdue.
- **Fix**: Add a sane `limit` (or pagination) on list queries and ignore stale fetch generations in the hook.
- **Decision**: FIXED — `.limit(200)` on driver lists; `fetchGen` in `useDriverOps`.

### F7 — Manual Phase 3/4 verification still open

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/driver-operations/plan.md:349-361
- **Detail**: Automated checks in this review: `npm run typecheck` pass; `npm run test` 81/81 pass; eslint on driver-ops paths pass. Progress still `- [ ]` 3.2, 3.3, 4.3 (mobile cycle, staff sees updates, API-level RLS smoke). Phase 1–2 manuals are `[x]` on implement SHAs.
- **Fix**: Run the plan’s Manual Testing Steps after `supabase db push`, then tick 3.2 / 3.3 / 4.3 with evidence.
- **Decision**: SKIPPED

### F8 — Driver staff-API deny is 403, plan success criteria said 401

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/middleware/auth.ts:99-104
- **Detail**: Unauthenticated APIs correctly return 401. Authenticated drivers hitting `/api/stats` etc. get 403 Forbidden. Phase 2 success criteria said “driver 401/302”. 403 is the usual authenticated-but-not-allowed status and matches tests.
- **Fix**: Addendum in the plan: drivers receive 403 on staff APIs, 302 on staff pages.
- **Decision**: SKIPPED

## Triage

- **Fixed:** F1 (Fix A), F2 (Fix A), F3 (Fix A), F4, F5 (Fix A), F6
- **Skipped:** F7, F8
