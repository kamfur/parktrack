# Settings Configuration Implementation Plan

## Overview

Staff-facing settings page at `/ustawienia` where the parking daily rate (PLN) and total parking capacity can be configured and saved. Uses the existing `settings` key-value table and PATCH API endpoints — no new API or schema design needed.

## Current State Analysis

- `settings` table exists with `total_parking_spots = "100"` (JSON string) seeded — `supabase/migrations/20251017120000_initial_schema.sql:101`
- `GET /api/settings` and `PATCH /api/settings?key=eq.<key>` fully functional — `src/pages/api/settings.ts`
- `daily_rate` key does not yet exist in the settings table — needs a new migration
- No `/ustawienia` Astro page exists (only `/`, `/rezerwacje`, `/rezerwacje/[id]`)
- `Navigation.tsx` has only Dashboard and Rezerwacje links — `src/components/Navigation.tsx:5`
- **Auth constraint (plan-review F1)**: `SUPABASE_KEY` is the anon key (`.env.example:6`). The `settings` table RLS policy is `to authenticated`, which blocks the anon key. `createSupabaseAdminClient()` exists in `src/lib/supabase-admin.ts` and uses `SUPABASE_SERVICE_ROLE_KEY` (currently not set in Railway). All settings reads/writes in this plan must go through the admin client, not `locals.supabase`.

## Desired End State

Staff can navigate to `/ustawienia` in the sidebar, see the current daily rate and parking capacity pre-filled from the DB, change either value, save, and see a Sonner success toast. The `daily_rate` and `total_parking_spots` rows in the `settings` table reflect the saved values immediately.

### Key Discoveries

- PATCH endpoint: `PATCH /api/settings?key=eq.<key>` with body `{ value: <new_value> }` — `src/pages/api/settings.ts:166`
- Form pattern: `useForm` + `zodResolver` + Shadcn/ui `Form` components — `src/components/reservations/FullReservationForm.tsx:1`
- Schema pattern: `src/lib/schemas/reservation.schema.ts` — settings schema goes in `src/lib/schemas/settings.schema.ts`
- Toast: Sonner is installed and `ToasterWrapper` already mounted via `Layout.astro` — ready to use
- `total_parking_spots` is currently stored as JSON string `"100"`. After first save from the form it will become JSON number. `Number()` on parse handles both formats.

## What We're NOT Doing

- Editing `reservation_buffer`, `default_currency`, or `retention_period_days` (out of S-01 scope)
- Building a new bulk API endpoint (reusing existing PATCH per key)
- Invoice or statistics work (S-02 / S-03)
- Server-side Zod validation in the API — existing PATCH accepts any `{ value }` body; client Zod is sufficient for this form

## Implementation Approach

Three phases: (1) seed `daily_rate` via migration + update PATCH handler to admin client + define Zod schema, (2) build `SettingsForm` React component and `/ustawienia` Astro page, (3) add nav link. The Astro page is the **first server-side data-fetching page** in this codebase — it uses `createSupabaseAdminClient()` in the frontmatter to read settings and pass initial values as props to the React component, avoiding a client-side loading state. All other pages use `client:load` with no frontmatter fetch; this establishes the SSR pattern for future pages (e.g., S-02 stats dashboard). Submit calls two sequential PATCH requests to the updated admin-client handler.

## Phase 1: Foundation

### Overview

Seed the `daily_rate` row in the DB (so the form always has a row to PATCH) and define the shared Zod schema.

### Changes Required

#### 0. Railway env var (user-action prerequisite)

**File**: Railway dashboard (manual step, not code)

**Intent**: Add `SUPABASE_SERVICE_ROLE_KEY` to Railway env vars so `createSupabaseAdminClient()` can bypass RLS for settings reads and writes. Without this, all settings operations fail silently.

**Contract**: In Railway dashboard → Service → Variables → add `SUPABASE_SERVICE_ROLE_KEY` = the service role key from Supabase dashboard → Settings → API → `service_role` (not `anon`). Do NOT commit to git or `.env`.

#### 1. New migration

**File**: `supabase/migrations/20260826120000_add_daily_rate_setting.sql`

**Intent**: Seed a `daily_rate` row in `settings` with value `0` (JSON number). Safe to re-apply — `ON CONFLICT DO NOTHING` prevents overwriting an already-configured rate.

**Contract**: Inserts `{ key: "daily_rate", value: 0, description: "Stawka dobowa parkingu (PLN)", updated_by: <first_auth_user_id> }`. The `DO $$ ... $$` block looks up a user via `SELECT id FROM auth.users LIMIT 1`. If no user exists (empty DB), the insert is skipped entirely to avoid a NOT NULL / FK violation. Value is SQL `'0'` which becomes JSONB number `0` — not the string `'"0"'` used by other settings; this is intentional because `daily_rate` is used arithmetically.

#### 1b. Admin client helper (addendum — unplanned, identified during review)

**File**: `src/lib/supabase-admin.ts`

**Intent**: Exports `createSupabaseAdminClient()` which returns a Supabase client using `SUPABASE_SERVICE_ROLE_KEY`, bypassing RLS. Returns `null` if env var is missing. Used by both the PATCH handler and `ustawienia.astro`.

**Contract**: Modified in ef39c88 alongside the Phase 1 planned files. Change is safe and load-bearing.

#### 2. Settings PATCH handler — switch to admin client

**File**: `src/pages/api/settings.ts`

**Intent**: The existing PATCH handler uses `locals.supabase` (anon key), which is blocked by RLS. Switch the PATCH handler to `createSupabaseAdminClient()` so writes bypass `to authenticated` restriction.

**Contract**: Import `createSupabaseAdminClient` from `"../../lib/supabase-admin"`. At the start of the PATCH handler, create the admin client: `const supabase = createSupabaseAdminClient()`. If `supabase` is null (env var missing), return `503 Service Unavailable` with `{ error: "Admin client unavailable — check SUPABASE_SERVICE_ROLE_KEY env var" }`. Replace the two `locals.supabase` references in the PATCH handler body with `supabase`. Leave GET and POST handlers unchanged (reads via GET currently fall back to defaults in consuming code; POST is for initial seeding).

#### 3. Zod schema file

**File**: `src/lib/schemas/settings.schema.ts` (new file)

**Intent**: Define and export the Zod schema for the settings form so it can be imported by the form component (and reused if future API-side validation is added).

**Contract**:
```ts
export const settingsSchema = z.object({
  daily_rate: z.number({ invalid_type_error: "Wymagana liczba" }).min(0, "Stawka nie może być ujemna"),
  total_parking_spots: z.number({ invalid_type_error: "Wymagana liczba" }).int("Musi być liczbą całkowitą").min(1, "Minimalna pojemność to 1"),
});
export type SettingsFormData = z.infer<typeof settingsSchema>;
```

### Success Criteria

#### Automated Verification

- Migration applies cleanly: `npx supabase db push` (local) or `npx supabase migration up`
- No TypeScript errors: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification

- Railway dashboard → Variables → `SUPABASE_SERVICE_ROLE_KEY` is set
- Supabase Table Editor → `settings` table → row with `key = "daily_rate"` exists with `value = 0`

**Implementation Note**: Add `SUPABASE_SERVICE_ROLE_KEY` to Railway BEFORE deploying Phase 2. Without it, settings.ts PATCH returns 503 and the form cannot save.

---

## Phase 2: Settings UI

### Overview

The settings page itself: an Astro page that fetches current settings server-side and renders a React form. On submit the form calls two sequential PATCHes and shows a Sonner toast.

### Changes Required

#### 1. SettingsForm component

**File**: `src/components/settings/SettingsForm.tsx` (new file)

**Intent**: React form for editing `daily_rate` and `total_parking_spots`. Receives initial values as props (no internal data fetch), validates client-side with Zod, submits two sequential PATCHes, and shows a toast on success or error.

**Contract**: Props `{ initialDailyRate: number; initialTotalSpots: number }`. Uses `settingsSchema` from `src/lib/schemas/settings.schema.ts`. Two form fields: `daily_rate` (number input, `min="0"`, `step="0.01"`, suffix label "PLN") and `total_parking_spots` (number input, `min="1"`, `step="1"`). Number `<Input>` `onChange` must call `field.onChange(parseFloat(...))` / `field.onChange(parseInt(..., 10))` so react-hook-form holds numbers, not strings.

Submit sequence:
1. `PATCH /api/settings?key=eq.daily_rate` with `{ value: data.daily_rate }`
2. If response not ok → throw, catch shows `toast.error`
3. `PATCH /api/settings?key=eq.total_parking_spots` with `{ value: data.total_parking_spots }`
4. If response not ok → throw, catch shows `toast.error`
5. Both succeed → `toast.success("Ustawienia zapisane")`

Button shows "Zapisywanie…" while `isSubmitting` is true.

#### 2. Ustawienia Astro page

**File**: `src/pages/ustawienia.astro` (new file)

**Intent**: Server-side fetch of current settings so the form loads pre-filled without a client-side waterfall. Renders `SettingsForm` with the fetched values.

**Contract**: Frontmatter imports `createSupabaseAdminClient` from `"../lib/supabase-admin"` and creates the admin client directly (server-only file — safe for service role key). Fetches from `supabaseAdmin.from("settings").select("key, value")`, extracts `daily_rate` and `total_parking_spots` by key, parses both with `Number()` (handles both JSON string `"100"` and JSON number `100`). Falls back to `0` if client unavailable or key missing. Passes as `initialDailyRate` and `initialTotalSpots` props to `<SettingsForm client:load />`. Uses the existing `Layout` component. Page `<h1>` heading: "Ustawienia".

### Success Criteria

#### Automated Verification

- No TypeScript errors: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification

- Navigate to `/ustawienia` — form loads with `daily_rate = 0` and `total_parking_spots = 100`
- Change daily_rate to `150`, save — success toast appears; reload the page — form shows `150`
- Change total_parking_spots to `75`, save — success toast appears; reload — form shows `75`
- Enter `-10` for daily_rate and submit — Zod error shown inline, no PATCH fired
- Enter `0` for total_parking_spots and submit — Zod error shown inline, no PATCH fired

**Implementation Note**: Confirm all manual verification steps pass before proceeding to Phase 3.

---

## Phase 3: Navigation

### Overview

Add "Ustawienia" to the sidebar so staff can reach the settings page from any screen.

### Changes Required

#### 1. Navigation link

**File**: `src/components/Navigation.tsx`

**Intent**: Insert "Ustawienia" as the third nav item so the settings page is reachable from the sidebar on desktop and the drawer on mobile.

**Contract**: Add `{ href: "/ustawienia", label: "Ustawienia", icon: Settings }` to the `navItems` array (line 5), after the "Rezerwacje" entry. Import `Settings` from `lucide-react` alongside the existing icon imports. The existing `isActive` function already handles this route correctly via `currentPath.startsWith(itemHref)`.

### Success Criteria

#### Automated Verification

- No TypeScript errors: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification

- "Ustawienia" link appears in the desktop sidebar on `/` and `/rezerwacje`
- Link is highlighted (active style) when on `/ustawienia`
- "Ustawienia" appears in the mobile drawer and navigates correctly

---

## Testing Strategy

### Manual Testing Steps

1. `/ustawienia` loads — form shows `0` for daily rate and `100` for capacity
2. Set daily rate to `150` → save → toast → reload → `150` persists
3. Set capacity to `75` → save → toast → reload → `75` persists
4. Enter `-10` for rate → submit → inline error shown, no network call
5. Enter `0` for capacity → submit → inline error shown, no network call
6. Sidebar: "Ustawienia" link present and active-highlighted on `/ustawienia`
7. Mobile: drawer shows "Ustawienia" and navigates correctly

## Migration Notes

`total_parking_spots` was seeded as JSON string `"100"`. After the first save from this form it becomes JSON number `100`. Three existing consumers already handle this correctly with `Number()` and fallback to 100 — **no changes needed to these files**:
- `src/hooks/useDashboard.ts:72` — reads via fetch, parses with `Number()`
- `src/lib/services/reservation.service.ts:54` — reads via Supabase query, parses with `Number()`
- `src/pages/api/availability.ts:85` — reads via Supabase query, parses with `Number()`

New code in S-02 and S-03 that reads any numeric setting must also use `Number()` when parsing the JSONB value.

## References

- Roadmap slice S-01: `context/foundation/roadmap.md`
- Existing settings API: `src/pages/api/settings.ts`
- Form pattern: `src/components/reservations/FullReservationForm.tsx`
- Schema pattern: `src/lib/schemas/reservation.schema.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Foundation

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db push` — ef39c88
- [x] 1.2 No TypeScript errors: `npm run build` — ef39c88
- [x] 1.3 Linting passes: `npm run lint` — ef39c88

#### Manual

- [x] 1.4 Railway dashboard shows `SUPABASE_SERVICE_ROLE_KEY` set — ef39c88
- [x] 1.5 Supabase Table Editor shows `daily_rate = 0` in settings table — ef39c88

### Phase 2: Settings UI

#### Automated

- [x] 2.1 No TypeScript errors: `npm run build` — 212dccd
- [x] 2.2 Linting passes: `npm run lint` — 212dccd

#### Manual

- [x] 2.3 `/ustawienia` loads with `daily_rate = 0` and `total_parking_spots = 100` — 212dccd
- [x] 2.4 Saving `daily_rate = 150` persists after page reload — 212dccd
- [x] 2.5 Saving `total_parking_spots = 75` persists after page reload — 212dccd
- [x] 2.6 Negative rate shows inline Zod error; no PATCH fired — 212dccd
- [x] 2.7 Zero capacity shows inline Zod error; no PATCH fired — 212dccd

### Phase 3: Navigation

#### Automated

- [x] 3.1 No TypeScript errors: `npm run build`
- [x] 3.2 Linting passes: `npm run lint`

#### Manual

- [x] 3.3 "Ustawienia" link appears in desktop sidebar — 212dccd
- [x] 3.4 Active highlight applied when on `/ustawienia` — 212dccd
- [x] 3.5 Mobile drawer shows and navigates to "Ustawienia" — 212dccd
