---
project: parktrack
assessed_at: 2026-09-16T09:48:49Z
agent_readiness: ready
context_type: brownfield
stack_components:
  language: TypeScript
  framework: Astro 5 (React 19 islands)
  build_tool: Vite (via Astro)
  test_runner: Vitest (+ Playwright e2e)
  package_manager: npm
  ci_provider: GitHub Actions
  deployment_target: Node standalone adapter (no Dockerfile in repo)
gates_passed: 4
gates_failed: 0
---

## Stack Components

**Language:** TypeScript. `package.json` scripts include `typecheck` (`tsc --noEmit`). `tsconfig.json` extends `astro/tsconfigs/strict` and sets `jsx: react-jsx`. Typed: yes.

**Framework:** Astro `^5.13.7` with `@astrojs/react` `^4.3.1` and React `^19.1.1`. `astro.config.mjs` sets `output: "server"` and `@astrojs/node` in `standalone` mode. File-based routing under `src/pages/`. UI: Tailwind CSS 4 (`@tailwindcss/vite`), data access via `@supabase/supabase-js` and `@supabase/ssr`. Zod is used at API boundaries (`AGENTS.md`: validate every API payload before business logic).

**Build tool:** Vite, configured through `astro.config.mjs` (`vite.plugins`, `optimizeDeps`). Not a standalone Vite + React app.

**Test runner:** Vitest `^4.1.11` (`npm test` → `vitest run`, `vitest.config.ts`, Node environment, `@` alias). Playwright `@playwright/test` `^1.62.1` for e2e (`test:e2e`, `playwright.config.ts`, `e2e/`).

**Package manager:** npm (`package-lock.json` at repo root).

**CI/CD:** GitHub Actions `.github/workflows/ci.yml` — `npm ci`, `npm run test`, `npm run lint`, `npm run build` on push/PR to `main`. Separate `.github/workflows/ai-review.yml`. CI does not run `typecheck` or Playwright.

**Deployment:** Node standalone via `@astrojs/node`. No `Dockerfile`, `docker-compose.yml`, or `vercel.json` at repo root.

**Instruction files:** `CLAUDE.md`, `AGENTS.md`, `src/pages/api/AGENTS.md`, `.cursor/rules/` (`astro.mdc`, `backend.mdc`, `frontend.mdc`, `react.mdc`, `shared.mdc`, `db-supabase-migrations.mdc`, `api-supabase-astro-init.mdc`, `ui-shadcn-helper.mdc`, `git-identity-kamfur.mdc`).

**PRD context (optional):** `context/foundation/prd.md` is an older brownfield PRD (statistics and invoicing) whose current-system stack matches this detection. The latest change PRD is `context/foundation/prd-v4.md`: scheduled KTW arrival hours on staff and driver return views, bound by saved flight direction in a ± about 3h window. That change does not introduce a new product surface or stack; it extends existing return views and reservation direction data.

## Quality Gate Assessment

| Component  | Typed | Convention | Training Data | Documented | Verdict |
|------------|-------|------------|---------------|------------|---------|
| Language   | ✓     | —          | —             | —          | pass    |
| Framework  | —     | ✓          | ✓             | ✓          | pass    |
| Build tool | —     | ✓          | ✓             | ✓          | pass    |
| Test runner| —     | —          | ✓             | ✓          | pass    |

Legend: ✓ = pass, ✗ = fail, ~ = partial, — = not applicable

### Gate Details

**Typed — pass.** `tsconfig.json` extends `astro/tsconfigs/strict`. `package.json` exposes `typecheck`. Source is `.ts` / `.tsx` / `.astro` with generated `src/db/database.types.ts`. Zod schemas sit at API boundaries (`AGENTS.md`, `src/lib/schemas/`).

**Convention-based — pass.** Astro is file-based routes plus islands (`src/pages/`, React islands for interactive UI). `AGENTS.md` and `.cursor/rules/astro.mdc` / `react.mdc` / `backend.mdc` document API handler shape (`prerender = false`, `GET`/`POST`), Supabase via `context.locals.supabase`, and Zod-before-logic. This is not an unopinionated Express/Vite-React layout.

**Popular in training data — pass (JS/TS family).** Astro, React, Vite, Vitest, and Playwright are mainstream within JavaScript/TypeScript. Scoring is within that family, not against Python/Java volume.

**Well-documented — pass.** Astro 5, React 19, Vite, Vitest, and Playwright each have current official, versioned documentation. Project instruction files point at those conventions rather than substituting for missing upstream docs.

## Gaps & Compensation

No quality-gate failures. No compensation rules are required for type safety, conventions, training-data familiarity, or documentation.

Observations that are **not** gate failures (downstream health-check territory):

- CI (`.github/workflows/ci.yml`) does not run `npm run typecheck` or Playwright, so type regressions can merge if they do not fail Vitest/lint/build.
- Deployment is Node standalone in config; there is no Dockerfile in this tree.

### Recommended Instruction File Additions

None. Existing `AGENTS.md` already covers API route shape, Zod at boundaries, React-islands-only, staff vs driver roles, and return-list operating windows — the surfaces `prd-v4.md` will extend.

## Summary

The stack is agent-ready out of the box: TypeScript strict, convention-based Astro + React islands, mainstream JS/TS tools, and current docs, plus instruction files that already describe parking-ops conventions. The flight-hours change stays on the same return views and does not need a stack change.

Next step: `/10x-health-check` — dependency health, test suite, and CI coverage (including the missing typecheck/e2e CI jobs noted above).
