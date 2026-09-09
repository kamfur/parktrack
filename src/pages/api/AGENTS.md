# API routes — local rules

Repo-wide rules: `@AGENTS.md`. Product/test depth: `@context/foundation/test-plan.md`.

## Adding a route

1. Create `src/pages/api/<path>.ts` (or `[param]/` folder).
2. Top of file: `export const prerender = false`.
3. Named exports only: `export const GET`, `POST`, … (uppercase).
4. Zod-validate body/query before any logic — schema in `src/lib/schemas/`.
5. Business logic in `src/lib/services/`; handler stays thin.
6. Supabase: `const supabase = context.locals.supabase` — never import `supabaseClient` in pages.

Reference shape: `@src/pages/api/settings.ts`.

## Testing

Integration tests colocated: `src/pages/api/<name>.test.ts`.  
Run one file: `npm run test -- src/pages/api/settings.test.ts`.

## Driver APIs

- Prefix: `/api/driver/*` — arrivals, departures, occupancy, reservation arrival/departure PATCH.
- Allowed roles: `driver` and `staff`. Staff-only APIs remain blocked for drivers in `authMiddleware`.
- List window: overdue + calendar today (Warsaw) — not staff `get_todays_*`.
- RLS defense-in-depth: migration `20260909140000_harden_rls_by_app_role.sql` — drivers cannot write invoices/settings; reservation UPDATEs constrained by status + column trigger.

## Tripwires

- Never skip auth assumption — protected routes must return 401/redirect (see `@context/foundation/test-plan.md` risk #5).
- PATCH/POST settings use admin client in handler — do not assume user RLS for writes.
- Drivers must not use `/api/reservations` — use `/api/driver/...` action routes.
