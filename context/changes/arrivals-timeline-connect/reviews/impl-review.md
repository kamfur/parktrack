<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Arrivals Timeline Connect

- **Plan**: context/changes/arrivals-timeline-connect/plan.md
- **Scope**: Phase 1–3 of 3
- **Date**: 2026-09-16
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 3 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Accepted product deltas vs original plan text

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/lib/ktw/select-arrival-hours.ts, src/lib/ktw/format-hours.ts, src/lib/ktw/katowice-board.adapter.ts
- **Detail**: During Phase 3 manual the user locked behavior the plan listed as out of scope or different: display official board `status` (live time/delay) instead of scheduled clock; cap to 3 nearest hours; fetch yesterday+today+tomorrow so 23:00 vs 00:10 matches; Madeira alias. Checkout, envelopes, and fail-soft are unchanged.
- **Fix A ⭐ Recommended**: Document these deltas as a plan addendum so archive/status treat them as intended.
  - Strength: Matches what staff/drivers already use; keeps Progress honest.
  - Tradeoff: Plan becomes a slightly moving target after implementation.
  - Confidence: HIGH — each delta was requested in this conversation and verified on Wyjazdy.
  - Blind spot: Original PRD FR-007 still says live ETA is nice-to-have; addendum should say v1 shows board status text, not a separate ETA field.
- **Fix B**: Revert to scheduled clocks, all hours, single-day fetch.
  - Strength: Strict plan fidelity.
  - Tradeoff: Drops the midnight and status behavior the user just accepted.
  - Confidence: HIGH — revert is mechanical; product would regress.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — plan addendum 2026-09-16

### F2 — Unrestricted KTW_ARRIVALS_URL fetch

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/ktw/katowice-board.adapter.ts:36
- **Detail**: Production fetch uses `KTW_ARRIVALS_URL` (any host/scheme) with default redirect following. Not request-controlled, but a poisoned env is server-side SSRF. Default official URL is safe.
- **Fix**: Allowlist `https:` plus katowice-airport.com (keep official-page remap); reject other hosts; prefer `redirect: "error"`.
- **Decision**: FIXED — https allowlist (`katowice-airport.com` / `*.katowice-airport.com`), official page remap, `redirect: "error"`

### F3 — Driver departures load the board twice

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/driver/departures.ts:28
- **Detail**: `Promise.all([listDepartures(), listHandledDepartures()])` each call `enrichDepartures` → up to 3 board GETs. Staff list is one enrich. Plan said one outbound request per list load. Driver UI polls every 60s.
- **Fix**: Fetch the board once in the handler (or a shared enricher) and attach hours to both `data` and `handled`.
  - Strength: Cuts driver board traffic from ~6 to ~3 GETs per poll.
  - Tradeoff: Small wiring change in DriverService or the API handler.
  - Confidence: HIGH — port is already injectable.
  - Blind spot: Occupancy is not enriched (correct).
- **Decision**: FIXED — `enrichDepartureLists` + `DriverService.listDeparturesWithHandled` share one board fetch for `data` and `handled`

### F4 — Extra hook handlers mixed into Phase 3 commit

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/hooks/useDashboard.ts, src/hooks/useDriverOps.ts
- **Detail**: Phase 3 commit also carries `handleCancel` / `handleChangeReturnDate` and driver handled-list state. Needed for the dirty dashboard/driver UI already in the working tree; not specified in this change’s Phase 3 file list.
- **Fix**: Leave as-is unless splitting calendar/driver-ops commits later; no behavior bug for KTW hours.
- **Decision**: SKIPPED — leave calendar/driver-ops hook extras for a later split commit; no KTW hours bug

### F5 — Parsed board row list is unbounded

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/ktw/katowice-board.adapter.ts:101
- **Detail**: A successful JSON `data` array is kept in full. Official KTW days are small; a huge payload would be scanned for ≤200 reservations.
- **Fix**: Cap parsed rows (e.g. 500) after parse.
- **Decision**: FIXED — `MAX_PARSED_BOARD_ROWS = 500` after parse

## Automated verification

- `npm run test` — 160/160 pass
- `npm run typecheck` — pass
- Phase 3 lint on touched files — no new errors (repo-wide lint still has older unrelated errors)

## Manual verification

- Progress 3.5–3.8 `[x]` after user confirmation on live Wyjazdy (including Madeira overnight, status text, 3-hour cap, PlaneLanding).
