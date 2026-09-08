# Repository Guidelines

ParkTrack — Astro 5 SSR + React 19 islands + Supabase. Staff-facing parking management.

**Context map:** `@context/README.md` · **Maturity:** `@context/maturity.md`

## Hard Rules

- **API routes:** `export const prerender = false`; handlers `export const GET` / `POST` (uppercase). Nested guide: `@src/pages/api/AGENTS.md`.
- **Supabase in pages:** `context.locals.supabase` only — type from `@src/db/supabase.client.ts`.
- **React:** interactive UI only; static content in `.astro`. No Next.js directives (`"use client"`, etc.).
- **Boundaries:** Zod-validate every API payload before business logic.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server — port 3000 |
| `npm run test` | Vitest (unit + integration) |
| `npm run test:e2e` | Playwright E2E |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Production build |

CI (`.github/workflows/ci.yml`): test → lint → build on PR/push to `main`.

## Depth — read on demand

| Topic | Doc |
|---|---|
| Product / roadmap | `@context/foundation/prd.md`, `@context/foundation/roadmap.md` |
| Tests & risks | `@context/foundation/test-plan.md` |
| Stack & deploy | `@context/foundation/tech-stack.md`, `@context/foundation/infrastructure.md` |
| Recurring rules | `@context/foundation/lessons.md` |
| Astro/React conventions | `@CLAUDE.md` (index only — no duplicate rules here) |

## Driver module (brownfield)

- Driver UI is mobile-first (tablet/smartphone): large tap targets, single-card operational flows; no staff admin chrome.
- Roles: `staff` (full access, unchanged) and `driver` (driver module only — no invoices, statistics, or full reservation admin). Role comes from Supabase Auth `app_metadata.role` (never `user_metadata`); missing role defaults to `staff`.
- Drivers and staff share the same reservation/payment records — never duplicate entities for field ops.
- Driver home path: `/kierowca`. Operating lists: overdue (any past day while still open) + calendar today — not staff `get_todays_*`.
- Driver-writable fields at arrival: confirm arrival, parking duration, flight direction, passenger count, sector, paid-at-arrival.
- Driver-writable fields at departure: complete departure, notes, paid-at-departure, dopłata (`surcharge_amount`) when actual return differs from planned.
- Shift management is out of scope for v1 — arrivals/departures lists are not shift-scoped yet.
- Staff dashboard cancel is out of scope for this module (separate change).

## Style & commits

TypeScript strict, kebab-case files, PascalCase components — enforced by `@eslint.config.js`.  
Commits: `feat:` / `chore:` / `fix:` (see `git log`). Husky runs lint-staged on commit.
