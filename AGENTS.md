# Repository Guidelines

ParkTrack is a server-rendered web app for parking lot management staff. Stack: Astro 5 (SSR, file-based routing) + React 19 (interactive islands) + TypeScript 5 + Supabase (PostgreSQL + Auth + RLS) + Tailwind CSS 4 + Shadcn/ui.

## Hard Rules

- **API routes**: export `const prerender = false` at the top of every file in `src/pages/api/`. Handlers are named exports: `export const GET`, `export const POST` (uppercase).
- **Supabase client**: read from `context.locals.supabase` in Astro routes — never import the client directly in page files. Type with `SupabaseClient` from `src/db/supabase.client.ts`, not from `@supabase/supabase-js`.
- **React only for interactivity**: use `.astro` components for static/layout content. React is for client-side state and events only.
- **No Next.js directives**: `"use client"`, `"use server"`, `getServerSideProps` have no effect in Astro and signal a wrong mental model.
- **Validate at the boundary**: all incoming API payloads must pass a Zod schema before any processing.

## Project Structure

- `src/pages/` — Astro pages (file-based routing)
- `src/pages/api/` — server-only endpoints; see hard rules above
- `src/layouts/` — Astro layout components
- `src/components/` — Astro (static) and React (interactive) components
- `src/components/ui/` — Shadcn/ui components (do not hand-edit; regenerate via Shadcn CLI)
- `src/lib/services/` — business logic extracted from handlers; keep handlers thin
- `src/db/` — Supabase client config and auto-generated `database.types.ts`
- `src/types.ts` — shared Entities and DTOs for frontend and backend
- `src/middleware/index.ts` — single Astro middleware file
- `supabase/migrations/` — SQL migrations; apply locally with `supabase db reset`

For extended conventions see `@CLAUDE.md`; for Tailwind, accessibility, and React hooks patterns see `@.github/copilot-instructions.md`.

## Build & Development Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server at `http://localhost:3000` |
| `npm run build` | Production build — run before pushing to catch type errors |
| `npm run lint` | ESLint (TypeScript strict + Astro + React rules) |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Prettier |

**No test runner configured.** Run `npm run lint` and `npm run build` as the primary correctness gate before every commit. Husky runs lint-staged on commit automatically — do not skip with `--no-verify`.

## Coding Style & Naming

TypeScript strict mode enforced via `@tsconfig.json` (extends `astro/tsconfigs/strict`). No `any`. Files use `kebab-case`; React component exports are `PascalCase`; utilities and hooks are `camelCase`. See `@eslint.config.js` for the full rule set.

## Commit Guidelines

Convention observed in history: `feat: <description>` and `chore: <description>`. No CI pipeline is configured yet — run `npm run lint` and `npm run build` locally before pushing.
