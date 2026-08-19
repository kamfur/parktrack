---
project: parktrack
assessed_at: 2026-08-19T00:00:00Z
agent_readiness: ready-with-compensation
context_type: brownfield
stack_components:
  language: TypeScript 5
  framework: Astro 5 + React 19
  build_tool: Vite (via @tailwindcss/vite)
  test_runner: null
  package_manager: npm
  ci_provider: null
  deployment_target: Docker on DigitalOcean
gates_passed: 4
gates_failed: 0
---

## Stack Components

**Language — TypeScript 5.** Configured with Astro's strict preset (`tsconfig.json` extends `"astro/tsconfigs/strict"`). ESLint extends `tseslint.configs.strict` and `tseslint.configs.stylistic`. Zod (`^3.25.76`) enforces schema validation at API boundaries. Type coverage is comprehensive end-to-end, including generated Supabase database types in `src/db/database.types.ts`.

**Framework — Astro 5 + React 19.** Astro provides the server-rendering shell, file-based routing (`src/pages/`), and SSR via the Node adapter (`@astrojs/node` standalone mode, port 3000). React 19 is used for interactive islands only (`@astrojs/react`). The division — Astro for static/layout, React for interactivity — is explicitly codified in the project's instruction files.

**Build tool — Vite.** Embedded in Astro 5's build pipeline. Tailwind CSS 4 runs as a Vite plugin (`@tailwindcss/vite`). No separate `vite.config.ts` is needed because Astro wraps it via `astro.config.mjs`.

**UI components — Shadcn/ui + Radix UI + Tailwind CSS 4.** Shadcn/ui components are stored in `src/components/ui/` with `components.json` as the registry config. All Radix primitives installed directly. `class-variance-authority`, `clsx`, and `tailwind-merge` handle variant composition.

**Backend / database — Supabase.** PostgreSQL with RLS, Auth, and Edge Functions hosted on Supabase cloud. Supabase client is configured in `src/db/supabase.client.ts`; database types auto-generated in `src/db/database.types.ts`. SQL migrations live in `supabase/migrations/`. Three migrations on disk covering the initial schema and two RPC functions for today's arrivals/departures.

**Test runner — not detected.** No `vitest.config.*`, `jest.config.*`, or `playwright.config.*` found. No test runner in `package.json` dependencies or scripts.

**Package manager — npm.** `package-lock.json` present at root.

**CI/CD — not detected.** No `.github/workflows/` directory. The PRD references GitHub Actions CI, but no workflow files exist in the repository yet.

**Deployment — Docker on DigitalOcean.** Stated in PRD. Dockerfiles exist under `parksite/` (legacy ASP.NET component) but not in the root Astro project. No `Dockerfile`, `fly.toml`, `render.yaml`, or cloud-run config at root level.

**Instruction files.** `CLAUDE.md` contains both the 10xDevs skill-chain routing instructions and a `## ParkTrack — Project Conventions` section with the full directory layout, Astro API route rules, Supabase client import rules, React component guidelines, and interim testing/CI instructions. `.github/copilot-instructions.md` contains the extended project guide for Copilot (accessibility, Tailwind, detailed React hooks patterns).

**Secondary component (out of change scope).** `parksite/parksite/parksite.csproj` — ASP.NET Core 6 web app added as a subproject in the same repo. Based on git history and the PRD's stated tech stack, this is a legacy external system and not the subject of the current change. All gates below are assessed against the primary Astro project only.

---

## Quality Gate Assessment

| Component    | Typed | Convention | Training Data | Documented | Verdict |
|--------------|-------|------------|---------------|------------|---------|
| Language     | ✓     | —          | —             | —          | pass    |
| Framework    | —     | ✓          | ✓             | ✓          | pass    |
| Build tool   | —     | ✓          | ✓             | ✓          | pass    |
| Test runner  | —     | —          | —             | —          | n/a     |

*Legend: ✓ = pass, — = not applicable, n/a = component absent*

**Overall: 4 / 4 gates pass. No gate failures.**

### Gate Details

**Type safety — PASS.**
Evidence: `tsconfig.json` at root extends `"astro/tsconfigs/strict"`. `eslint.config.js` applies `tseslint.configs.strict` and `tseslint.configs.stylistic` to all TS/TSX files. Zod schemas used for API boundary validation (required by `CLAUDE.md`: "Validate all incoming data with Zod before processing"). Supabase database types are generated and consumed from `src/db/database.types.ts`, giving the agent typed row shapes for every table.

**Convention-based — PASS.**
Evidence: Astro 5 ships strong file-system conventions — pages in `src/pages/`, API endpoints in `src/pages/api/`, layouts in `src/layouts/`. `CLAUDE.md` extends this with explicit rules: the Astro/React division of responsibility, middleware location (`src/middleware/index.ts`), Supabase client import pattern (`context.locals.supabase`), service extraction convention (`src/lib/services/`), and API handler naming format (`export const GET/POST`, `export const prerender = false`).

**Popular in training data — PASS (within JS/TS ecosystem).**
Evidence: Astro is a mainstream framework for server-rendered TypeScript apps; React is the dominant UI library in the JS/TS ecosystem; Supabase is a widely adopted BaaS with a large open-source corpus; Tailwind CSS 4 and Shadcn/ui both have extensive community coverage. Zod is the de-facto TypeScript validation library. All components are high-signal within the JS/TS training corpus.

**Well-documented — PASS.**
Evidence: Astro 5 has versioned official docs at astro.build; React 19 docs at react.dev; Supabase at docs.supabase.com (comprehensive, version-aware); Tailwind CSS 4 at tailwindcss.com; Shadcn/ui at ui.shadcn.com (per-component docs); Zod at zod.dev. All components have current, official documentation that an agent can reason from.

---

## Gaps & Compensation

No quality gates failed. The two practical gaps below do not lower the gate scores but do affect how reliably an agent can work end-to-end.

### Gap 1: No test runner configured

**What failed:** No test runner (Vitest, Jest, Playwright) is installed or configured. `package.json` contains no `test` script.

**Why it matters for agent workflows:** Agents use test suites as a correctness signal — "run tests, check output, iterate." Without one, an agent working on the statistics module or invoice generation has no automated feedback loop beyond TypeScript type-checking. The agent will default to building and relying on the type system alone, which catches shape errors but not behavioral bugs.

**Current compensation (already in CLAUDE.md):**
```
### Testing (current state: no test runner configured)
- Until Vitest is added, rely on TypeScript strict mode and Zod validation as the primary correctness signal.
- Run `npm run lint` and `npm run build` before marking any task complete.
- Verify behavior manually via `npm run dev` (port 3000).
```

**Recommended fix:** Add Vitest for unit/integration testing and Playwright for end-to-end tests. When added, remove the interim note from `CLAUDE.md` and replace with the actual `npm run test` command.

### Gap 2: No CI/CD pipeline

**What failed:** No `.github/workflows/` directory despite the PRD specifying GitHub Actions CI. No lint, build, or deployment pipeline exists as code.

**Why it matters for agent workflows:** Without CI, there is no automated gate that catches broken builds or lint violations before they reach the repository. An agent making multiple changes across files cannot rely on a pipeline to flag regressions.

**Current compensation (already in CLAUDE.md):**
```
### CI/CD (current state: no pipeline configured)
- Run `npm run lint` and `npm run build` locally; treat any error as a blocker.
```

**Recommended fix:** Add a minimal GitHub Actions workflow that runs `npm run lint` and `npm run build` on pull requests. When added, remove the interim note from `CLAUDE.md` and replace with CI status badge or reference to the workflow file.

---

## Summary

ParkTrack's primary stack (TypeScript 5 + Astro 5 + React 19 + Supabase + Zod) passes all four agent-readiness criteria: it is typed end-to-end, convention-based (Astro's file routing plus documented project conventions in `CLAUDE.md`), mainstream within the JS/TS training corpus, and backed by current official documentation.

The verdict is **ready-with-compensation** — not because any quality gate failed, but because two practical gaps create friction in agent workflows: no test runner and no CI pipeline. Both gaps have interim compensation rules already written into `CLAUDE.md`. The conventions gap (previously Gap 3) has been resolved — `CLAUDE.md` now contains the full `## ParkTrack — Project Conventions` section.

**Key strengths:** Strict TypeScript throughout; Zod at API boundaries; Supabase-generated types giving the agent typed DB row shapes; project conventions (directory layout, Supabase client pattern, API route rules, Astro/React division) documented directly in `CLAUDE.md` for Claude Code to pick up automatically.

**Key gaps:** No automated test feedback loop; no CI gate. Both are independent work items unblocked from the current change scope.

**Recommended next step:** `/10x-health-check`
