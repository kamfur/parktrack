# Testing quality gates — Implementation Plan

## Overview

Phase 4 of the test rollout (`context/foundation/test-plan.md §3`). Wires `npm run test`,
`npm run lint`, and `npm run build` into a GitHub Actions CI workflow that runs on every PR
targeting main and on every push to main. Adds a Husky pre-push hook so tests also fail fast
locally before reaching CI.

## Current State Analysis

No `.github/workflows/` directory exists — zero CI today. The project has:
- `npm run test` — Vitest (41 tests, ~400 ms); configured in `vitest.config.ts`
- `npm run lint` — ESLint across the full repo
- `npm run build` — Astro SSR build; no env vars needed at compile time (server bundle resolves
  `import.meta.env` at runtime)
- Husky v9 pre-commit hook at `.husky/pre-commit` running `npx lint-staged` (ESLint on staged
  files); no pre-push hook exists

### Key Discoveries:

- `package.json` — scripts `test`, `lint`, `build` are all defined and working locally
- `vitest.config.ts` — `environment: "node"`, path alias `@` → `./src`; no special globals config needed
- `.husky/pre-commit` — single-line `npx lint-staged`; pre-push follows the same pattern
- Husky v9 (`9.1.7`) — hooks are plain shell scripts; no `#!/usr/bin/env sh` shebang required by the runner, but conventional to include for portability
- `astro.config.mjs` — `output: "server"` (SSR); build does not prerender pages or call APIs at compile time

## Desired End State

- `.github/workflows/ci.yml` exists and runs on `push` to `main` and `pull_request` targeting
  `main`; the workflow installs dependencies with `npm ci`, then runs `npm run test`,
  `npm run lint`, and `npm run build` sequentially on Node 20 / ubuntu-latest
- `.husky/pre-push` exists and runs `npm run test`; a `git push` that would fail CI is caught
  locally first
- Both gates are verified via a real push/PR

## What We're NOT Doing

- **Parallel CI jobs** — single sequential job is sufficient for a project of this size
- **Matrix testing** (multiple Node versions) — Node 20 is the sole target
- **Supabase env vars in CI** — SSR build resolves `import.meta.env` at runtime; no compile-time
  secret needed; revisit if a prerendered page is ever added
- **Caching `node_modules`** — `npm ci` is fast enough at this dep count; caching adds config
  complexity for minimal gain
- **Deployment from CI** — Railway autodeploys from git; CI is a quality gate only, not a deploy
  trigger
- **E2E or browser tests in CI** — not in M-1 rollout scope

## Implementation Approach

Two files, two phases. Phase 1 creates the GitHub Actions workflow YAML. Phase 2 adds the
Husky pre-push hook. Each phase is independently committable and verifiable.

---

## Phase 1: GitHub Actions CI workflow

### Overview

Create `.github/workflows/ci.yml` with a single job that installs, tests, lints, and builds
on every PR to main and every push to main.

### Changes Required:

#### 1. CI workflow file

**File**: `.github/workflows/ci.yml` (new file; also requires `.github/` directory creation)

**Intent**: Define the GitHub Actions workflow that enforces test + lint + build on every PR
and push to main, so broken code cannot merge silently.

**Contract**: The workflow has two triggers (`push: branches: [main]` and
`pull_request: branches: [main]`). One job `ci` runs on `ubuntu-latest`, uses
`actions/checkout@v4` and `actions/setup-node@v4` with `node-version: '20'`, installs with
`npm ci`, then runs three sequential steps named "Run tests" (`npm run test`),
"Run lint" (`npm run lint`), and "Build" (`npm run build`).

### Success Criteria:

#### Automated Verification:

- File exists: `test -f .github/workflows/ci.yml`
- YAML is syntactically valid: `npm run build` still passes locally (proxy for no config error breaking the project)

#### Manual Verification:

- Push the branch to GitHub and open a PR targeting main; the `ci` workflow appears in the PR's Checks tab
- All three steps (tests, lint, build) show green in the GitHub Actions run log
- Confirm the workflow name and job name match the file as written

**Implementation Note**: The lint step will show the same pre-existing ESLint errors in
`src/components/ui/` that exist locally — the step will fail unless those are fixed or
the step is configured to tolerate them. See "Critical Implementation Details" below.

---

## Phase 2: Pre-push test gate

### Overview

Add a Husky pre-push hook so `npm run test` runs before every `git push`. This catches
test regressions locally before they consume a CI run.

### Changes Required:

#### 1. Pre-push hook

**File**: `.husky/pre-push` (new file)

**Intent**: Run the full test suite before any push, mirroring what CI will do, so the
developer gets immediate feedback without waiting for GitHub Actions.

**Contract**: A single-line shell script containing `npm run test`. Follows the same
minimal pattern as `.husky/pre-commit`. The file must be executable (`chmod +x`).

### Success Criteria:

#### Automated Verification:

- File exists: `test -f .husky/pre-push`
- File is executable: `test -x .husky/pre-push`
- Tests still pass: `npm run test`

#### Manual Verification:

- Make a trivial commit and run `git push`; confirm "npm run test" output appears in the terminal before the push completes
- Break one test locally (e.g., change an assertion), attempt `git push`, confirm the push is blocked and the failure message is shown; restore the test

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before committing.

---

## Critical Implementation Details

**Lint step in CI will fail on pre-existing errors.** `npm run lint` currently exits with
code 1 due to pre-existing prettier/ESLint errors in `src/components/ui/` (vendored Shadcn
components) and `src/components/reservations/AvailabilityIndicator.tsx`. The CI workflow's
lint step will fail on every run until these are resolved or the lint config is adjusted.

Two options, to be decided at implementation time:
1. **Fix the pre-existing violations** — run `npm run lint:fix` and commit the result. The
   `src/components/ui/` files are vendored (CLAUDE.md: "do not hand-edit"), but `lint:fix`
   applying formatter fixes is not hand-editing. Assess after running.
2. **Add an `.eslintignore` or adjust `eslintrc`** to exclude the `src/components/ui/`
   directory from the linter. This is the safer option if `lint:fix` changes the vendored
   files in surprising ways.

The implementer must resolve this before Phase 1 can show a green CI run. This is tracked as
a manual verification item — the CI lint step passing green is the gate.

---

## Testing Strategy

### Manual Testing Steps:

1. Push the `testing-quality-gates` branch and open a PR targeting main; verify the workflow triggers
2. Confirm all three steps pass (note: lint step depends on pre-existing error resolution — see Critical Implementation Details)
3. Make a trivial change to a test file that causes a test to fail, push the branch, confirm the CI run fails on the "Run tests" step
4. Restore the test, verify CI goes green
5. Test the pre-push hook: break a test locally, attempt `git push`, confirm the hook blocks the push

## References

- Test-plan Phase 4: `context/foundation/test-plan.md §3` (row 4)
- Test-plan quality gates: `context/foundation/test-plan.md §5`
- Existing pre-commit hook: `.husky/pre-commit`
- Vitest config: `vitest.config.ts`
- `package.json` scripts: `test`, `lint`, `build`, `lint:fix`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: GitHub Actions CI workflow

#### Automated

- [x] 1.1 File exists: `test -f .github/workflows/ci.yml`
- [x] 1.2 Build passes locally: `npm run build`

#### Manual

- [ ] 1.3 PR shows the `ci` workflow in the Checks tab on GitHub
- [ ] 1.4 All three CI steps (tests, lint, build) show green in the Actions run log

### Phase 2: Pre-push test gate

#### Automated

- [ ] 2.1 File exists: `test -f .husky/pre-push`
- [ ] 2.2 File is executable: `test -x .husky/pre-push`
- [ ] 2.3 Tests pass: `npm run test`

#### Manual

- [ ] 2.4 `git push` shows test output before push completes
- [ ] 2.5 Broken test blocks push; restored test allows push
