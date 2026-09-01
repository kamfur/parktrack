<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Settings Configuration Implementation Plan

- **Plan**: `context/changes/settings-configuration/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-26
- **Verdict**: SOUND (post-triage)
- **Findings**: 1 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|---|---|
| End-State Alignment | FAIL → PASS (F1 fixed) |
| Lean Execution | PASS |
| Architectural Fitness | WARNING → PASS (F2 documented) |
| Blind Spots | PASS |
| Plan Completeness | WARNING → PASS (F3 fixed) |

## Grounding

5/5 paths ✓, symbols ✓, brief↔plan mostly consistent (brief flagged RLS risk as open — plan now resolves it via F1 fix).

## Findings

### F1 — Settings form silently fails to save and loads wrong initial values

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Phase 2 — SettingsForm + Astro page
- **Detail**: `SUPABASE_KEY` is the anon key (`.env.example:6`). Settings RLS `to authenticated` blocks anon key. PATCH returns 404 on every save; Astro SSR read returns [] so form loads 0/0 instead of 0/100. `createSupabaseAdminClient()` exists at `src/lib/supabase-admin.ts:10` but `SUPABASE_SERVICE_ROLE_KEY` not set in Railway.
- **Fix Applied**: Fix A — Added Railway env var manual step to Phase 1; updated settings PATCH handler to use `createSupabaseAdminClient()`; updated Astro page SSR fetch to use admin client.
- **Decision**: FIXED via Fix A

### F2 — SSR fetch in Astro frontmatter is a new pattern with no existing precedent

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — Ustawienia Astro page
- **Detail**: All existing pages (index.astro, rezerwacje.astro) are pure shell pages with client:load. Plan introduces SSR fetch in Astro frontmatter — first time in this codebase.
- **Fix Applied**: Fix A — Kept SSR approach, added explicit note in Implementation Approach documenting this as the first SSR data-fetch page establishing the pattern for S-02.
- **Decision**: FIXED via Fix A

### F3 — Migration Notes miss three existing consumers of total_parking_spots

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Migration Notes
- **Detail**: Note said "S-02/S-03 must use Number()" but useDashboard.ts:72, reservation.service.ts:54, availability.ts:85 already correctly use Number() with fallback. Could mislead implementer.
- **Fix Applied**: Updated Migration Notes to name the 3 existing consumers, confirm they need no changes, and scope the forward note to new code only.
- **Decision**: FIXED
