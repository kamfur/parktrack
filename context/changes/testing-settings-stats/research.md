---
date: 2026-09-02T13:15:00+00:00
researcher: claude-sonnet-4-6
git_commit: 6da8f9c739ddeb3ce2d9a018a75ea18af5f78656
branch: main
repository: parktrack
topic: "Settings admin client RLS failure path and stats Warsaw timezone boundary"
tags: [research, codebase, settings, stats, supabase-admin, timezone, rls]
status: complete
last_updated: 2026-09-02
last_updated_by: claude-sonnet-4-6
---

# Research: Settings admin client RLS failure path and stats Warsaw timezone boundary

**Date**: 2026-09-02T13:15:00+00:00
**Researcher**: claude-sonnet-4-6
**Git Commit**: 6da8f9c739ddeb3ce2d9a018a75ea18af5f78656
**Branch**: main
**Repository**: parktrack

## Research Question

Ground Phase 3 of the test rollout: Risk #3 (settings write fails silently when
service role key absent) and Risk #6 (stats display wrong month total at month-end
due to Warsaw timezone boundary).

## Summary

**Risk #3 — partial correction of the original risk statement.** The original
test-plan description says "PATCH returns 200 but nothing persists." This is
**inaccurate for current code**: the PATCH handler explicitly returns HTTP 503
when `createSupabaseAdminClient()` returns null. The remaining testable risk is
narrower: *prove the 503 behavior cannot regress to a silent 200*, and *prove the
page-level SSR read degrades visibly rather than silently loading stale defaults*.
The cheapest test is a direct handler call with the env var unset, asserting a
non-200 response.

**Risk #6 — correctly stated, well-grounded.** `getWarsawPeriodBounds()` is a
**pure function** in `src/pages/api/stats.ts` (lines 11–54) that constructs ISO
8601 boundary strings with the Warsaw UTC offset appended. If the `${tz}` suffix
is dropped in a future refactor, Supabase interprets the timestamps as UTC,
shifting the month boundary by 1–2 hours. Because the function is pure and
exported, it is **unit-testable without a running server**: call it with a mocked
`Date` at a UTC/Warsaw boundary instant and assert the returned strings carry the
correct offset. This is cheaper and more precise than a full integration test.

---

## Detailed Findings

### Risk #3: Settings Admin Client

#### `createSupabaseAdminClient()` definition

**File**: `src/lib/supabase-admin.ts:10–32`

```typescript
export function createSupabaseAdminClient(): ReturnType<typeof createClient<Database>> | null {
  const supabaseUrl = import.meta.env.SUPABASE_URL;
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;  // line 12

  if (!supabaseUrl) {
    console.error("Missing SUPABASE_URL environment variable");
    return null;  // line 16
  }

  if (!serviceRoleKey) {
    console.error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Admin operations require the service role key to bypass RLS."
    );
    return null;  // line 23
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {...});
}
```

- **Env var**: `SUPABASE_SERVICE_ROLE_KEY` (`import.meta.env`, line 12)
- **Missing key**: returns `null`, logs to console only — does NOT throw
- **Type**: declared `readonly SUPABASE_SERVICE_ROLE_KEY?: string` in `src/env.d.ts:22` — optional

#### PATCH handler behavior when key is absent

**File**: `src/pages/api/settings.ts:84–142`

```typescript
export const PATCH: APIRoute = async ({ url, request }) => {
  try {
    const supabase = createSupabaseAdminClient();  // line 86
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Admin client unavailable — check SUPABASE_SERVICE_ROLE_KEY env var" }),
        { status: 503, headers: { "Content-Type": "application/json" } }  // lines 88–91
      );
    }
    // ... update and return 200 ...
  }
};
```

**Finding**: The PATCH handler is **not silent** — it returns HTTP 503 with an explicit
error message when the admin client is null. The original risk statement ("PATCH returns
200 but nothing persists") does not match the current implementation.

**What to test**: Assert that when `SUPABASE_SERVICE_ROLE_KEY` is unset, `PATCH /api/settings`
returns a status ≠ 200 (specifically 503). This prevents a regression where a future
refactor reverts to the anon client or removes the null check.

#### Page-level SSR read — the remaining silent failure

**File**: `src/pages/ustawienia.astro:6, 15–31`

```typescript
const supabaseAdmin = createSupabaseAdminClient();  // line 6

let initialDailyRate = 0;    // hardcoded default
let initialTotalSpots = 100; // hardcoded default

if (supabaseAdmin) {
  const { data } = await supabaseAdmin.from("settings").select("key, value");
  // ...parse into initialDailyRate, initialTotalSpots...
}
// if supabaseAdmin is null — silently uses defaults, no user warning
```

**Finding**: The SSR page read DOES fail silently — no error toast, no user-visible
indicator. The form renders with hardcoded defaults (0/100). This is the remaining
genuine silent-failure path. However, any subsequent PATCH will return 503 and show
a toast error, so data loss does not occur.

#### Client-side form error handling

**File**: `src/components/settings/SettingsForm.tsx:40–79`

```typescript
const results = await Promise.all([
  fetch("/api/settings?key=eq.daily_rate", { method: "PATCH", ... }),
  // ...5 more PATCH requests...
]);
if (results.some((r) => !r.ok)) throw new Error("Błąd zapisu ustawień"); // line 75
```

- Correctly checks `!r.ok` for all responses — 503 will trigger the error path
- Toast error shown, but message is generic (no mention of missing env var)

#### Supabase client architecture

- **Anon client**: `src/db/supabase.server.ts:15–38` — `createSupabaseServerClient()` reads `SUPABASE_KEY`; stored in `locals.supabase` by middleware
- **Admin client**: `src/lib/supabase-admin.ts:10–32` — reads `SUPABASE_SERVICE_ROLE_KEY`
- **Settings table RLS**: `to authenticated` policy blocks the anon key; only admin client bypasses it

---

### Risk #6: Stats Warsaw Timezone Boundary

#### `getWarsawPeriodBounds()` — the pure function to test

**File**: `src/pages/api/stats.ts:11–54`

```typescript
function getWarsawPeriodBounds(period: string): { start: string; end: string } {
  const now = new Date();

  // Resolve current Warsaw UTC offset dynamically (handles CET/CEST DST)
  const tzPart = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Warsaw",
    timeZoneName: "shortOffset",
  })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT+2";  // fallback: line 23
  const match = tzPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
  const sign = match?.[1] ?? "+";
  const hh = String(match?.[2] ?? "2").padStart(2, "0");
  const mm = String(match?.[3] ?? "0").padStart(2, "0");
  const tz = `${sign}${hh}:${mm}`;  // e.g., "+02:00" or "+01:00"

  // Get the current date in Warsaw timezone (NOT UTC)
  const warsawDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
  }).format(now);
  const [year, month, day] = warsawDate.split("-").map(Number);

  // Month bounds (lines 46–53)
  const monthStr = String(month).padStart(2, "0");
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStr = String(nextMonth).padStart(2, "0");
  return {
    start: `${year}-${monthStr}-01T00:00:00${tz}`,   // e.g., "2026-09-01T00:00:00+02:00"
    end:   `${nextYear}-${nextMonthStr}-01T00:00:00${tz}`,
  };
}
```

**Critical finding**: The function constructs **ISO 8601 strings with explicit offset** (e.g.,
`2026-10-01T00:00:00+02:00`). Supabase parses these and compares them to stored UTC
timestamps in `actual_check_out`. If the `${tz}` suffix is dropped (regression), Supabase
interprets them as UTC, shifting the month boundary by the Warsaw offset (1–2 hours
depending on DST). A reservation checked out at `2026-09-30T22:00:00Z` (= Oct 1, 00:00
Warsaw) would be incorrectly counted in September instead of October.

**Note**: The archive plan describes `DATE_TRUNC('month', actual_check_out AT TIME ZONE 'Europe/Warsaw')` SQL, but the current implementation uses ISO 8601 range strings passed to `.gte()` / `.lt()`. The result is equivalent at month granularity, but the approach differs. The test oracle must use ISO 8601 string comparison, not SQL truncation.

#### Revenue field and query

**File**: `src/pages/api/stats.ts:115–122`

```typescript
supabase
  .from("reservations")
  .select("total_cost")
  .eq("status", "completed")
  .not("actual_check_out", "is", null)
  .gte("actual_check_out", start)   // start = "YYYY-MM-01T00:00:00+HH:MM"
  .lt("actual_check_out", end),     // end   = "YYYY-MM-01T00:00:00+HH:MM"
```

- **Bucketing field**: `actual_check_out` — the actual departure timestamp (not planned)
- **Filter**: only `status = "completed"` reservations with non-null `actual_check_out`
- **Aggregation**: `src/pages/api/stats.ts:146–147` — sum + round to 2dp

#### Function is not exported

**File**: `src/pages/api/stats.ts:11` — `function getWarsawPeriodBounds` (no `export` keyword)

**Implication**: The function is not exported. To unit-test it, either:
1. **Export it** (add `export` — minimal change, keeps function testable)
2. **Test via HTTP** (requires a running Astro dev server — expensive for a unit test)
3. **Extract to a utility module** (e.g., `src/lib/utils/timezone.ts`) and test there

**Recommendation**: Option 1 (add `export`) is cheapest. The plan should include this
minimal change as a prerequisite for the unit test.

#### Response DTO

**File**: `src/types.ts:88–98`

```typescript
export interface StatsData {
  arrivalsCount: number;
  departuresCount: number;
  occupancyPct: number;
  freeSpots: number;
  totalSpots: number;
  revenue: number;
  period: StatsPeriod;
}
```

#### Occupancy invariant (relevant for test scoping)

From `context/archive/2026-08-29-statistic-dashboard/plan.md:45–46`:
> Occupancy (current live count of reservations with `status='in_progress'`) is not
> filtered by date regardless of Day/Month toggle — always reflects current state.

This means occupancy tests do not need timezone-aware seeding.

---

## Code References

- `src/lib/supabase-admin.ts:10–32` — `createSupabaseAdminClient()`: reads `SUPABASE_SERVICE_ROLE_KEY`, returns null when absent
- `src/env.d.ts:22` — `SUPABASE_SERVICE_ROLE_KEY?: string` — declared optional
- `src/pages/api/settings.ts:84–91` — PATCH handler: returns 503 when admin client null
- `src/pages/ustawienia.astro:6, 15–31` — SSR read: silently uses defaults when admin client null
- `src/components/settings/SettingsForm.tsx:75` — client-side: `!r.ok` check on all PATCH responses
- `src/db/supabase.server.ts:15–38` — anon client factory (stored in `locals.supabase`)
- `src/middleware/supabase.ts:7–11` — middleware stores anon client in `locals.supabase`
- `src/pages/api/stats.ts:11–54` — `getWarsawPeriodBounds()`: pure function, not exported
- `src/pages/api/stats.ts:115–122` — revenue query: `.gte("actual_check_out", start).lt(..., end)`
- `src/pages/api/stats.ts:146–147` — revenue aggregation: sum + round
- `src/types.ts:88–98` — `StatsData` DTO

## Architecture Insights

**Settings architecture**: Two-client design: `locals.supabase` (anon key, for authenticated
user reads subject to RLS) and `createSupabaseAdminClient()` (service role, bypasses RLS).
Settings table has `to authenticated` RLS — all writes and admin reads must use the service
role client. The PATCH handler already enforces this with a 503 guard; the regression risk is
that a refactor removes the null check or reverts to `locals.supabase`.

**Stats architecture**: `getWarsawPeriodBounds()` is the single point of timezone correctness.
It uses `Intl.DateTimeFormat` for dynamic DST-aware offset resolution (no hardcoded `+02:00`),
then constructs ISO 8601 strings with the resolved offset. All five stat queries use the same
`{start, end}` pair. The function is not exported, which is the sole obstacle to unit testing.

**Test layer recommendation**:

| Risk | Cheapest test | Why |
|------|--------------|-----|
| #3 — PATCH 503 when key absent | Direct handler call, env var unset | `PATCH: APIRoute` is importable; same pattern as auth.test.ts |
| #3 — SSR read silent failure | Document only (not testable without DOM) | SSR read in .astro file, no export surface |
| #6 — timezone boundary | Unit test on `getWarsawPeriodBounds()` after exporting | Pure function, no DB or server needed |

## Historical Context (from prior changes)

- `context/archive/2026-08-26-settings-configuration/plan.md:14–77` — RLS constraint noted as blocker; `createSupabaseAdminClient()` created; PATCH migrated from anon to admin client; Railway env var prerequisite documented
- `context/archive/2026-08-26-settings-configuration/plan-brief.md:54–56` — risk: "if `SUPABASE_KEY` is the anon key, PATCH to settings will be blocked by `to authenticated` RLS"
- `context/archive/2026-08-29-statistic-dashboard/plan.md:43–77` — Warsaw timezone boundary was an explicit design requirement; implemented using `AT TIME ZONE 'Europe/Warsaw'` (original SQL approach); current code uses ISO 8601 strings instead (same effective boundary)
- `context/archive/2026-08-29-statistic-dashboard/plan-brief.md:65` — open assumption: "if DB server timezone is already Warsaw, double conversion is harmless but redundant"
- `context/archive/2026-09-02-testing-auth-guard/research.md:103–107` — `/api/stats` has no handler-level auth check; relies entirely on middleware

## Open Questions

1. **Risk #3 risk statement correction**: The plan's §2 says "PATCH returns 200 but nothing persists" — this is stale. Current code returns 503. The test plan should be backport-corrected: the risk is now "PATCH null-check regresses and reverts to 200 silent failure, OR SSR read silently loads stale defaults." Recommend flagging this for a §2 correction.

2. **`getWarsawPeriodBounds` export**: The function must be exported (or extracted) to enable unit testing. The plan should include `export function getWarsawPeriodBounds(...)` as a prerequisite step in Phase 1.

3. **DST boundary test**: The function uses `Intl.DateTimeFormat` to resolve the current DST-adjusted offset. A test that mocks `Date` to a known CEST (summer, +02:00) and CET (winter, +01:00) instant can verify both offsets are resolved correctly. This is worth including as two test cases.

4. **`actual_check_out` vs `planned_check_out`**: Revenue bucketing uses `actual_check_out`. A reservation that is `completed` but has `actual_check_out` near the Warsaw month boundary is the correct seed for the boundary test. The test must set `status: "completed"` and `actual_check_out` to a timestamp at the UTC/Warsaw boundary.

5. **Stats endpoint auth**: The `/api/stats` handler has no handler-level auth — it relies on the middleware. This was covered by Phase 1 (`testing-auth-guard`) and is documented. No additional work needed here.
