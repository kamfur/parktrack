---
project: parktrack
checked_at: 2026-09-14T09:05:00Z
health_status: critical-issues
context_type: brownfield
language_family: js
stack_assessment_available: true
checks_run:
  - lockfile
  - dependency_audit
  - outdated_deps
  - test_runner
  - ci_cd
  - configuration
audit_findings:
  critical: 2
  high: 15
  moderate: 6
  low: 5
test_runner_detected: true
ci_provider: GitHub Actions
recommended_fixes: 6
---

## Dependency Health

### Lockfile

Status: present (package-lock.json)
Package manager: npm

### Security Audit

Tool: `npm audit --json`
Summary: 2 CRITICAL, 15 HIGH, 6 MODERATE, 5 LOW
Direct vs transitive: Direct — `astro` (CRITICAL), `@astrojs/node` (MODERATE), `supabase` (MODERATE, via `tar`), `eslint` (LOW). Remaining HIGH/CRITICAL (`tar` and toolchain packages) are transitive. npm reports `fixAvailable: true` for the listed packages.

#### CRITICAL findings

- **astro** `5.13.7` (direct, advisory range `<=7.2.7`) — GHSA-26w7-cxv4-gfx2 (CVSS 9.8): remote code execution through AVIF image optimization. Same package also carries HIGH items including GHSA-qcpr-679q-rhm2 (image-proxy SSRF/XSS) and GHSA-wrwg-2hg8-v723 (reflected XSS via server islands). Fix: upgrade Astro on the current major first (`npm outdated` wanted `5.18.2`), then re-run `npm audit`. Do not jump to Astro 7 in the same change without a dedicated upgrade plan.
- **tar** `<=7.5.20` (transitive, pulled by the `supabase` CLI package) — node-tar path traversal / symlink / DoS advisories (e.g. GHSA-34x7-hfp2-rc4v, GHSA-23hp-3jrh-7fpw). Fix: bump `supabase` toward wanted `2.117.0` and re-run `npm audit`; if `tar` remains, inspect `npm ls tar`.

#### HIGH findings

- **brace-expansion**, **browserslist**, **defu**, **devalue**, **h3**, **js-yaml**, **minimatch**, **nanoid**, **picomatch**, **postcss**, **rollup**, **sharp**, **smol-toml**, **vite**, **ws** — transitive HIGH advisories (DoS, prototype pollution, path traversal, XSS stringify, Windows fs.deny bypass, libvips via sharp). Fix: after the Astro/`@astrojs/node` patch bump, run `npm audit` again; apply non-breaking `npm audit fix` only after reviewing the lockfile diff. Do not run `npm audit fix --force`.

MODERATE (6): `@astrojs/node` (direct; body-size DoS, SSRF, Host-header issues — patch available in `9.5.4+`, wanted `9.5.5`), `@humanfs/node`, `ajv`, `mdast-util-to-hast`, `supabase` (via tar), `yaml`. LOW (5): `@babel/core`, `@eslint/plugin-kit`, `diff`, `eslint` (direct, via plugin-kit), `postcss-selector-parser`.

### Outdated Dependencies

Packages with major version gaps: 15 (latest major differs from current; 2+ majors behind listed below)

- **astro**: 5.13.7 → 7.3.2 (2 major versions behind; wanted within v5 is 5.18.2)
- **@astrojs/node**: 9.4.3 → 11.1.5 (2 major versions behind; wanted within v9 is 9.5.5)
- **@astrojs/react**: 4.3.1 → 6.0.5 (2 major versions behind)
- **eslint-plugin-astro**: 1.3.1 → 3.1.0 (2 major versions behind)
- **eslint-plugin-react-hooks**: 5.2.0 → 7.1.1 (2 major versions behind)
- **lint-staged**: 15.5.0 → 17.5.1 (2 major versions behind)
- **zod**: 3.25.76 → 4.6.5 (1 major; high impact if migrated)

Also 1-major gaps not expanded here: `@eslint/js` 9→10, `eslint` 9→10, `@vitest/ui`/`vitest` 4→5, `lucide-react` 0→1, `prettier-plugin-astro` 0→1, `react-day-picker` 9→10.

## Test Suite

Test runner: Vitest
Tests found: 81 tests (41 suites)
Test execution: passing

Configuration: `vitest.config.ts`
Framework: Vitest `^4.1.11` (`npm test` → `vitest run`), Node environment; `e2e/` excluded from unit runs.

Playwright is configured (`playwright.config.ts`, `npm run test:e2e`) with 4 specs under `e2e/`. Not executed in this check (starts `npm run dev` and needs `.env` / auth storage). CI does not run Playwright.

## CI/CD

Provider: GitHub Actions
Configuration: `.github/workflows/ci.yml` (also `.github/workflows/ai-review.yml`)

| Stage      | Status | Notes                                      |
|------------|--------|--------------------------------------------|
| Lint       | ✓      | `npm run lint` (ESLint)                    |
| Test       | ✓      | `npm run test` (Vitest; not Playwright)    |
| Build      | ✓      | `npm run build`                            |
| Type check | ✗      | `npm run typecheck` exists locally, not in CI |
| Security   | ✗      | no `npm audit`, Dependabot, CodeQL, or Snyk step |

## Configuration

### High severity

(none — `.gitignore` present; `tsconfig.json` extends `astro/tsconfigs/strict`)

### Medium severity

(none — `eslint.config.js` and `.prettierrc.json` present)

### Low severity

- **.editorconfig** — missing. Editors and the agent may disagree on indent/charset. Fix: add a root `.editorconfig` (e.g. `root = true`, `indent_style = space`, `indent_size = 2`, `end_of_line = lf`, `charset = utf-8`, `insert_final_newline = true`).
- **CI typecheck** — not a missing file; `tsconfig` is strict but `.github/workflows/ci.yml` never runs `tsc --noEmit`. Fix: add a step `run: npm run typecheck` after `npm ci`.

`.env.example` is present. `CLAUDE.md` and `AGENTS.md` are present.

## Stack Assessment Cross-Reference

Stack assessment: context/foundation/stack-assessment.md
Agent readiness (from stack-assess): ready

| Quality Gate Gap      | Health-Check Finding                              | Status       |
|-----------------------|---------------------------------------------------|--------------|
| (none failed)         | Typed config present (`astro/tsconfigs/strict`)   | Aligned      |
| Typecheck not in CI (note, not a gate fail) | CI has lint/test/build only; no `tsc --noEmit` | Reinforced   |
| Compensation entries  | `CLAUDE.md` / `AGENTS.md` / `.cursor/rules` present | Mitigated    |

The stack is agent-ready; operational health is not. CRITICAL/HIGH advisories on Astro and the install tree are the blocker for agent work on request/image paths.

## Recommended Fixes

#### Fix before agent work (Category A)

### 1. Critical: Astro 5.13.7 (RCE / XSS / SSRF advisories)

**Impact**: Agents generating image, middleware, or server-island code will sit on a runtime with a CVSS 9.8 AVIF RCE advisory (GHSA-26w7-cxv4-gfx2) plus XSS/SSRF findings. Untrusted request handling is not a safe surface until patched.
**Severity**: critical
**Effort**: moderate (15–30 min) for a 5.x bump; significant (> 1 hour) if you also take Astro 7
**Fix**:

```bash
npm install astro@5.18.2 @astrojs/node@9.5.5
npm run test
npm run typecheck
npm audit
```

Stay on Astro 5 until the 7.x upgrade is a dedicated change. Do not run `npm audit fix --force`.

### 2. Critical: transitive `tar` (via `supabase` CLI)

**Impact**: Install/extract tooling can write outside intended paths. Lower runtime risk than Astro RCE, but the audit tree is still CRITICAL.
**Severity**: critical
**Effort**: quick (< 5 min)
**Fix**:

```bash
npm install supabase@2.117.0 --save-dev
npm ls tar
npm audit
```

### 3. High transitive toolchain advisories (Vite, Rollup, sharp, ws, …)

**Impact**: Dev-server and image-pipeline issues (e.g. Vite path traversal, sharp/libvips) can bite local agent loops and any image optimization path.
**Severity**: high
**Effort**: moderate (15–30 min)
**Fix**: After items 1–2, inspect `npm audit` and apply a reviewed `npm audit fix` (no `--force`). Re-run `npm test`.

### 4. Direct moderate: `@astrojs/node` 9.4.3

**Impact**: Same adapter that serves production (`output: "server"`). Unpatched body-size and Host-header issues affect the live Node adapter.
**Severity**: high (adapter is production; npm labels the package moderate)
**Effort**: quick (< 5 min) if bundled with the Astro 5.18.2 bump above
**Fix**: included in the `npm install astro@5.18.2 @astrojs/node@9.5.5` command.

### 5. CI does not run `npm run typecheck`

**Impact**: Agents can land type-unsafe TypeScript that Vitest and ESLint miss. Stack-assess already flagged this; local `tsconfig` is strict but CI will not catch it.
**Severity**: medium
**Effort**: quick (< 5 min)
**Fix**: In `.github/workflows/ci.yml`, after `npm ci`, add:

```yaml
      - name: Typecheck
        run: npm run typecheck
```

### 6. Missing `.editorconfig`

**Impact**: Convenience; agent and editor formatting can drift.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**: Add `.editorconfig` at the repo root with space indent 2 and UTF-8 (see Configuration above).

#### Addressed in upcoming lessons (Category B)

### Playwright not in CI; no container file in-repo

**Lesson**: [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)
**What you'll do there**: Wire deploy/CI coverage (e2e, containers) once the walking skeleton is in place. Local Vitest is enough for agent collaboration now.

### No dependency-scanning step in CI (Dependabot / audit / CodeQL)

**Lesson**: [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)
**What you'll do there**: Add a recurring security scan in CI. Until then, treat `npm audit` as a local gate (Category A items 1–3).

Agent instruction files (`CLAUDE.md`, `AGENTS.md`) already exist — no onboarding stub needed.

## Summary

Health status: critical-issues

Lockfile and Vitest are in good shape: 81 unit tests passed, ESLint/Prettier/strict TypeScript and agent instruction files are present, GitHub Actions runs test/lint/build. The install is not: npm reports 2 CRITICAL and 15 HIGH findings, including a CVSS 9.8 Astro image-optimization RCE on the direct `astro@5.13.7` dependency and a CRITICAL `tar` tree via the Supabase CLI.

Next step: patch Astro 5.x and `@astrojs/node` 9.5.x, bump `supabase`, re-run `npm audit` and `npm test`, then add `npm run typecheck` to CI. After Category A, proceed to agent onboarding with a cleaner dependency tree.
