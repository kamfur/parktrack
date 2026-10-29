# Context maturity — ParkTrack

Observable ladder for when to add structure. **Do not skip levels** — each solves a failure mode the previous one cannot.

## Levels

| Level | Name | Signal you are here | ParkTrack (2026-09-03) |
|---|---|---|---|
| 0 | Ad hoc | No `AGENTS.md`, agent guesses from code | ✅ passed |
| 1 | Root index | Hard rules + commands in `AGENTS.md` | ✅ current |
| 2 | System of record | `context/foundation/` owns PRD, roadmap, test-plan | ✅ current |
| 3 | Nested area guides | Repeated mistakes or distinct rules in one folder | 🟡 **starting** — `src/pages/api/AGENTS.md` |
| 4 | Per-module + hooks | 200+ files in area, or CI enforces what context declares | ⬜ not yet |

## Triggers → action

| Trigger | Action |
|---|---|
| Root `AGENTS.md` > ~150 lines or duplicate blocks | Prune; move detail to `@context/` or nested `AGENTS.md` |
| Agent breaks same rule 3× in one folder | Add `AGENTS.md` in that folder (cite one sibling as exemplar) |
| Stale command in root file (`npm run X` fails) | Fix root or delete line — stale context is worse than none |
| New milestone (e.g. Driver Ops) | Update `@context/foundation/roadmap.md`, not root essay |
| Polyrepo / org standards | User/org-level rules (M5-L3) — do not duplicate in repo root |

## ParkTrack metrics (snapshot)

- ~127 TS/Astro source files under `src/`
- Distinct boundaries: `pages/api/` (Zod + services), `lib/services/`, `components/` (Astro vs React)
- Test layers: Vitest (unit/integration), Playwright (E2E) — see `@context/foundation/test-plan.md`

**Next review:** after Driver Ops roadmap (`prd-v2`) or when `src/` exceeds ~200 files.
