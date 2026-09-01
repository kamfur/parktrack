# Settings Configuration — Plan Brief

> Full plan: `context/changes/settings-configuration/plan.md`

## What & Why

Add a `/ustawienia` settings page where parking staff can configure the daily rate (PLN) and total parking capacity. These two values are prerequisites for S-02 (occupancy = active reservations / capacity) and S-03 (invoice total = days × daily_rate) — nothing downstream can be meaningful until they are set.

## Starting Point

The `settings` key-value table and all three API endpoints (GET / POST / PATCH) already exist and work in production. `total_parking_spots` is already seeded as `"100"`. What's missing: the `daily_rate` key in the DB, the `/ustawienia` Astro page, the `SettingsForm` React component, and the sidebar nav link.

## Desired End State

Staff opens "Ustawienia" in the sidebar, sees the current daily rate (initially 0) and parking capacity (initially 100), edits either or both, saves, and sees a success toast. Values are immediately reflected in the DB and will be consumed correctly by the statistics dashboard and invoice generator in later slices.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| API call strategy | Two sequential PATCHes to existing endpoints | Reuses working infrastructure; one extra round-trip is negligible for a 2-field form | Plan |
| JSONB value type for daily_rate | JSON number (not string) | Arithmetic downstream (S-02, S-03) doesn't require parsing | Plan |
| Default seed value | 0 | No null-handling complexity; staff sees 0 and knows to configure | Plan |
| Settings page scope | daily_rate + total_parking_spots only | Stays within S-01 roadmap scope; other settings have no UI surface yet | Plan |

## Scope

**In scope:**
- New migration seeding `daily_rate = 0`
- `src/lib/schemas/settings.schema.ts` — Zod schema
- `src/components/settings/SettingsForm.tsx` — React form
- `src/pages/ustawienia.astro` — SSR Astro page
- `src/components/Navigation.tsx` — add "Ustawienia" nav link

**Out of scope:** Editing `reservation_buffer`, `default_currency`, `retention_period_days`; any invoice or statistics work; new API endpoints.

## Architecture / Approach

Astro SSR fetches current settings in the page frontmatter (server-side, no client waterfall) and passes them as initial props to the React form via `client:load`. The form is purely presentational on load — no client fetch. On submit, two sequential `PATCH /api/settings?key=eq.<key>` calls (existing endpoints) update the DB.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Foundation | `daily_rate` row seeded; Zod schema defined | Migration may fail if DB has no auth users yet (DO block guards against this) |
| 2. Settings UI | Working `/ustawienia` form with save + toast | `total_parking_spots` stored as JSON string "100" — `Number()` parse required |
| 3. Navigation | "Ustawienia" in sidebar + mobile drawer | None — mechanical addition |

**Prerequisites:** Railway production DB must have the migration applied (`npx supabase db push` or via Supabase dashboard) before the page reads a real `daily_rate`.

**Estimated effort:** ~1 session, 3 phases.

## Open Risks & Assumptions

- `SUPABASE_KEY` env var is the service role key (bypasses RLS). If it's the anon key, PATCH to the settings table will be blocked by the `to authenticated` RLS policy.
- `total_parking_spots` changes from JSON string to JSON number on first save — downstream S-02/S-03 code must use `Number()` when reading it.

## Success Criteria (Summary)

- Staff can set `daily_rate = 150` on `/ustawienia`, save, reload, and see `150` persisted
- Staff can set `total_parking_spots = 75`, save, reload, and see `75` persisted
- Form shows inline validation errors for negative rate or zero capacity (no API call fired)
