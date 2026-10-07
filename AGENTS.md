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
| `npx supabase test db` | pgTAP DB tests (`supabase/tests/*.test.sql`) — needs local Supabase (`npx supabase start`) |

CI (`.github/workflows/ci.yml`): job `ci` test → lint → build; job `db-tests` runs pgTAP against a fresh local DB. DB triggers/RPCs that enforce money or access rules get a pgTAP test.

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
- Driver home path: `/kierowca`. Operating lists: overdue (any past day while still open) + calendar today. Handled arrivals/departures: Warsaw today **or** last 12 hours (union), by `actual_check_in` / `actual_check_out`.
- Staff dashboard `/`: same operating window as driver lists — Warsaw today plus overdue unconfirmed arrivals and delayed in-progress returns. Staff can check-in or cancel from arrivals, and check-out or change the return date from departures.
- Staff calendar: `/kalendarz` is staff-only. It shows planned arrivals/departures and timed driver shifts; staff create, edit, and delete overlapping shifts from that view. Driver lists at `/kierowca` remain unscoped by shift.
- RLS: JWT `app_metadata.role` — drivers SELECT reservations + operational UPDATE only; staff keep full table access; invoices/settings/payments are staff-only. Service role still bypasses RLS (external create, admin settings).
- Driver-writable fields at arrival: confirm arrival, parking duration, flight direction, passenger count, sector, paid-at-arrival.
- Driver-writable fields at departure: complete departure, notes, paid-at-departure, dopłata (`surcharge_amount`) when actual return differs from planned.
- KTW hours: staff and driver departure lists enrich after the existing query. If the public board is down or times out, omit `ktw_arrival_hours` and still return 200. Do not fail the departures endpoint to “fix” a missing board.

## Style & commits

TypeScript strict, kebab-case files, PascalCase components — enforced by `@eslint.config.js`.  
Commits: `feat:` / `chore:` / `fix:` (see `git log`). Husky runs lint-staged on commit.
