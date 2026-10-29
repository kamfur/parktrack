# Testing quality gates — Plan Brief

> Full plan: `context/changes/testing-quality-gates/plan.md`

## What & Why

Phase 4 of the test rollout closes the CI gap: today there is no GitHub Actions workflow, so
broken code can be pushed to main without any automated gate. This plan creates a workflow
that runs the existing `npm run test`, `npm run lint`, and `npm run build` on every PR and
push to main, and adds a Husky pre-push hook so tests also fail fast locally before the push
reaches GitHub.

## Starting Point

The project has 41 passing Vitest tests, ESLint, and a working Astro SSR build — all runnable
via npm scripts. Husky v9 is installed with a pre-commit hook (lint-staged) but no pre-push
hook. No `.github/` directory exists.

## Desired End State

A PR to main triggers a GitHub Actions `ci` workflow with three sequential green steps: tests,
lint, build. A `git push` that would fail CI is blocked locally by the pre-push hook before it
reaches GitHub.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| CI trigger | PR to main + push to main | PRs get a gate before merge; pushes to main catch squash-merge regressions |
| Job structure | Single job, sequential (test → lint → build) | Simplest config; test is the most likely failure and fails fast |
| Node version | Node 20 (LTS) | Current LTS, matches Railway default |
| Env vars in CI | None needed | Astro SSR build resolves `import.meta.env` at runtime, not compile time |
| Pre-push hook | Yes — `npm run test` | Catches failures locally before consuming a CI run; ~400 ms overhead |

## Scope

**In scope:**
- `.github/workflows/ci.yml` — workflow file
- `.husky/pre-push` — pre-push test gate
- Resolving pre-existing ESLint failures so the CI lint step passes

**Out of scope:**
- Parallel CI jobs, Node version matrix
- Supabase env vars in CI secrets
- `node_modules` caching
- Deployment from CI (Railway autodeploys from git)
- E2E tests in CI

## Architecture / Approach

Two files. The workflow uses `actions/checkout@v4` + `actions/setup-node@v4` (Node 20),
`npm ci` for a clean install, then three sequential steps. The pre-push hook follows the
identical pattern to the existing pre-commit hook — a single `npm run test` line.

**One known blocker**: `npm run lint` currently exits with code 1 due to pre-existing
prettier/ESLint errors in vendored `src/components/ui/` files. The implementer must resolve
these (via `npm run lint:fix` or an `.eslintignore` exclusion) before the CI lint step can go
green. This is the primary risk of the plan.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. GitHub Actions CI | `.github/workflows/ci.yml`; CI runs on PR and push to main | Pre-existing lint errors cause lint step to fail — must be resolved |
| 2. Pre-push hook | `.husky/pre-push`; tests run before every push | Low risk — follows established Husky pattern |

**Prerequisites:** GitHub repository with Actions enabled (standard for public/private repos on GitHub)
**Estimated effort:** ~1 session, 2 short phases (plus lint-fix work if `lint:fix` is needed)

## Open Risks & Assumptions

- **Pre-existing lint failures** — `npm run lint` exits 1 today; the lint step in CI will
  fail until these are fixed or scoped out. `lint:fix` on vendored files may produce
  unexpected diffs — inspect before committing.
- **Astro SSR build without env vars** — assumed safe because `output: "server"` doesn't
  execute server code at build time; if a prerendered page is added later, this assumption
  must be re-evaluated.

## Success Criteria (Summary)

- PR to main shows the `ci` workflow in the Checks tab and all three steps go green
- `git push` with a broken test is blocked locally by the pre-push hook
- `git push` with passing tests completes normally
