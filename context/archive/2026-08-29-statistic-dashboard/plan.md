# Statistics Dashboard Implementation Plan

## Overview

Extend the existing dashboard at `/` with 4 updated statistics panels (Arrivals, Departures, Occupancy, Revenue), a global Day/Month period toggle, and 60-second background polling. A new `/api/stats` endpoint centralizes all metric computation server-side.

## Current State Analysis

- `/` renders `<DashboardContainer client:load />` — an existing React dashboard with 4 metric cards: Available Spots, Total Reservations, Planned Arrivals, Planned Departures.
- `useDashboard` hook fetches three things in parallel on mount: `POST /api/rpc/get_todays_arrivals`, `POST /api/reservations/departures`, `GET /api/settings?key=eq.total_parking_spots`. Metrics are computed client-side from the returned arrays. No polling.
- `MetricsSection` renders 4 `MetricCard` components. `MetricCard` accepts `{ icon, value, label, accentColor }` — no subtitle slot.
- `reservations.total_cost` is stored (denormalized, updated by `trg_update_cost` trigger). Revenue aggregation is a straightforward `SUM(total_cost)` query on the existing table.
- No stats endpoint exists. No period toggle component exists.
- `createSupabaseAdminClient()` is established and used by `src/pages/api/settings.ts` PATCH and `src/pages/ustawienia.astro`.

## Desired End State

Staff opens the dashboard and sees 4 live statistics panels with a Day/Month toggle at the top of the metrics section. In Day mode the cards show today's figures; in Month mode they show the current calendar month's totals. Data refreshes silently every 60 seconds. The check-in/check-out TodayView below the cards is unaffected by the toggle and remains always today-scoped. Switching the toggle instantly re-fetches stats without a full page reload.

### Key Discoveries

- `src/hooks/useDashboard.ts:72` — `Number()` parse on `total_parking_spots` setting (handles both `"100"` string and `100` number JSONB values).
- `src/components/dashboard/MetricCard.tsx` — single `value: number` prop, no subtitle slot; needs extension.
- `src/components/dashboard/MetricsSection.tsx` — hardcoded 4-card layout with specific icons/colors; needs full replacement of card config.
- `supabase/migrations/20260828120000_update_arrivals_departures_to_nearest.sql` — `get_todays_arrivals()` returns reservations for the nearest upcoming check-in date (status=`confirmed`), not strictly "today's date". The stats API must query the `reservations` table directly for period-scoped counts, not call these RPC functions.
- Occupancy = `COUNT(*) WHERE status='in_progress'`; this is always current/live and does not vary with the Day/Month toggle period.

## What We're NOT Doing

- Historical occupancy chart or daily breakdown (parked — M-2 scope)
- CSV export of statistics
- Custom date range picker (only Day and current calendar month)
- Real-time WebSocket subscription (60 s polling is sufficient for MVP)
- Separate `/statystyki` page (S-02 extends the existing `/` dashboard)
- Server-side Zod validation in the new `/api/stats` endpoint for the response shape (query params are validated; response is internal)

## Implementation Approach

Two cleanly separated phases: (1) backend — a new `/api/stats` endpoint that returns all 4 metric values in one round trip; (2) frontend — update the hook to add period state + polling + stats fetch, update types, and rework the three affected components. The TodayView below the metric cards is untouched.

The stats endpoint uses `createSupabaseAdminClient()` (same as PATCH settings) to bypass RLS for aggregate queries. All four metrics come back in a single response; the client does no aggregation.

## Critical Implementation Details

**Occupancy is period-invariant.** The Occupancy card always shows current live data — `COUNT(*) WHERE status='in_progress'` — regardless of whether the toggle is in Day or Month mode. Do not filter occupancy by date in the API.

**Month boundary.** "Current month" means `DATE_TRUNC('month', field AT TIME ZONE 'Europe/Warsaw') = DATE_TRUNC('month', NOW() AT TIME ZONE 'Europe/Warsaw')`. Using UTC truncation would shift the month boundary by 1–2 hours for a Warsaw-timezone parking operation.

**Polling teardown.** The `setInterval` in `useDashboard` must be cleared in the `useEffect` cleanup function to avoid memory leaks and stale fetches after component unmount.

---

## Phase 1: Stats API Endpoint

### Overview

New `GET /api/stats?period=day|month` endpoint that returns all 4 dashboard metric values in one response. Uses the admin client to query the `reservations` and `settings` tables directly.

### Changes Required

#### 1. Stats API route

**File**: `src/pages/api/stats.ts` (new file)

**Intent**: Serve all 4 metric values (arrivalsCount, departuresCount, occupancyPct, freeSpots, totalSpots, revenue) in a single request. Period-scoping is handled server-side.

**Contract**: `export const prerender = false`. Named `export const GET: APIRoute`. Validates `?period=day|month` with Zod (`.enum(['day', 'month'])`, default `'day'`). Uses `createSupabaseAdminClient()` — return 503 if null (same error message pattern as settings PATCH). Runs four parallel Supabase queries via `Promise.all`:

1. **arrivalsCount** — `reservations` table, `COUNT(*)`, filter by period:
   - day: `planned_check_in::date = CURRENT_DATE AND status = 'confirmed'`
   - month: `DATE_TRUNC('month', planned_check_in AT TIME ZONE 'Europe/Warsaw') = DATE_TRUNC('month', NOW() AT TIME ZONE 'Europe/Warsaw')`
2. **departuresCount** — `reservations` table, `COUNT(*)`, filter by period:
   - day: `planned_check_out::date = CURRENT_DATE AND status = 'in_progress'`
   - month: `DATE_TRUNC('month', planned_check_out AT TIME ZONE 'Europe/Warsaw') = DATE_TRUNC('month', NOW() AT TIME ZONE 'Europe/Warsaw')`
3. **occupancy** — `reservations` table, `COUNT(*)` where `status = 'in_progress'`; always current regardless of period. Also fetch `total_parking_spots` from settings (same pattern as availability.ts:85 — `Number()` parse, fallback 100).
4. **revenue** — `reservations` table, `SUM(total_cost)` where `status = 'completed'` and `actual_check_out` falls in the selected period (same date truncation as arrivals/departures).

Response shape (200):
```ts
{
  arrivalsCount: number;
  departuresCount: number;
  occupancyPct: number;   // Math.round((occupied / totalSpots) * 100)
  freeSpots: number;      // totalSpots - occupied
  totalSpots: number;
  revenue: number;        // COALESCE(SUM, 0), rounded to 2 decimal places
  period: 'day' | 'month';
}
```

Error responses: 400 for invalid period, 503 for missing admin client, 500 for DB errors.

### Success Criteria

#### Automated Verification

- No TypeScript errors: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification

- `GET /api/stats?period=day` returns a valid JSON response with all 6 numeric fields
- `GET /api/stats?period=month` returns different revenue/count values than day mode
- `GET /api/stats?period=invalid` returns 400
- `GET /api/stats` (no param) defaults to `period=day` without error

**Implementation Note**: Confirm all manual checks pass before proceeding to Phase 2.

---

## Phase 2: Dashboard Metrics Update

### Overview

Update types, the `useDashboard` hook (period state, stats fetch, polling), and the three affected dashboard components (MetricCard, MetricsSection, DashboardContainer). TodayView and ReservationCard are untouched.

### Changes Required

#### 1. Shared types

**File**: `src/types.ts`

**Intent**: Add the period type and stats response shape so hook and components share a single source of truth.

**Contract**: Add:
```ts
export type StatsPeriod = 'day' | 'month';

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

Update `DashboardData` to include `stats: StatsData` alongside the existing `metrics`, `todaysArrivals`, and `todaysDepartures` fields. (Keep `DashboardMetrics` for the TodayView counts that are computed from the arrival/departure list arrays — those are unchanged.)

#### 2. useDashboard hook

**File**: `src/hooks/useDashboard.ts`

**Intent**: Add `period` state with `setPeriod`, fetch stats from `/api/stats?period=...`, and set up 60-second polling. The three existing parallel fetches (arrivals list, departures list, settings) are retained unchanged for the TodayView.

**Contract**: Add `period: StatsPeriod` state (default `'day'`). Add `setPeriod` setter exposed in the return value. Add a fourth parallel fetch to `fetchDashboardData`: `GET /api/stats?period=${period}`. Store result as `StatsData` in hook state. Add a `useEffect` that calls `refetch` on a 60 000 ms interval and clears the interval on cleanup. When `period` changes, trigger an immediate `refetch` (either re-run the effect or call `fetchDashboardData` directly in a separate `useEffect([period])` dependency). Expose `period` and `setPeriod` in the hook's return object.

#### 3. MetricCard component

**File**: `src/components/dashboard/MetricCard.tsx`

**Intent**: Add an optional `subtitle` prop so the Occupancy card can display "X wolnych miejsc" below the primary value.

**Contract**: Add `subtitle?: string` to `MetricCardProps`. When present, render it below the primary value in a smaller muted text style (e.g., `text-sm text-neutral-500`). Existing callers that omit `subtitle` are unaffected (backward compatible — optional prop).

#### 4. MetricsSection component

**File**: `src/components/dashboard/MetricsSection.tsx`

**Intent**: Replace the existing 4-card config with the S-02 metrics (Arrivals, Departures, Occupancy, Revenue) and add a Day/Month toggle at the top of the section.

**Contract**: Props change to `{ stats: StatsData; period: StatsPeriod; onPeriodChange: (p: StatsPeriod) => void; isLoading: boolean }`. The period toggle is a pair of buttons (Dziś / Miesiąc) rendered above the metric grid, styled consistently with existing Shadcn/ui button patterns. The 4 cards:

| Card | Primary value | Subtitle | Icon | Color |
|------|--------------|----------|------|-------|
| Przyjazdy | `arrivalsCount` | — | `ArrowRight` (existing) | orange |
| Wyjazdy | `departuresCount` | — | `ArrowLeft` (existing) | purple |
| Obciążenie | `occupancyPct` + "%" | `"${freeSpots} wolnych miejsc"` | `ParkingCircle` (existing) | green |
| Przychód | `revenue` formatted as "X PLN" | — | `DollarSign` from lucide-react | blue |

Revenue display: format with `toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` + " PLN" suffix.

Remove the old `calculateMetrics` result props (`availableSpots`, `totalReservations`, etc.) — those are no longer needed by MetricsSection.

#### 5. DashboardContainer component

**File**: `src/components/dashboard/DashboardContainer.tsx`

**Intent**: Wire the new `period`/`setPeriod` and `stats` from the updated hook into `MetricsSection`. Remove the old `DashboardMetrics`-based props passing to MetricsSection.

**Contract**: Destructure `period`, `setPeriod`, and `stats` from `useDashboard()`. Pass them to `<MetricsSection stats={stats} period={period} onPeriodChange={setPeriod} isLoading={isLoading} />`. The loading skeleton for MetricsSection remains 4 cards (unchanged shape). TodayView props (`data.todaysArrivals`, `data.todaysDepartures`, check-in/out handlers) are unchanged.

### Success Criteria

#### Automated Verification

- No TypeScript errors: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification

- Dashboard loads with 4 updated metric cards and a Dziś/Miesiąc toggle above them
- Switching to "Miesiąc" updates all 4 cards with month-to-date values; Arrivals and Departures counts increase noticeably; Revenue shows month total
- Occupancy card shows percentage + "X wolnych miejsc" subtitle; value does not change when toggling period
- Revenue card shows PLN-formatted value with 2 decimal places
- Network tab confirms a `GET /api/stats?period=day` (or `month`) request fires on every toggle click and every 60 seconds
- Check-in and check-out operations in TodayView still work; metrics refresh after operation completes
- No console errors in either period mode

---

## Testing Strategy

### Manual Testing Steps

1. Load `/` — 4 updated stat cards and Dziś/Miesiąc toggle appear
2. Toggle to Miesiąc — stats update (counts and revenue change); occupancy stays the same
3. Toggle back to Dziś — stats revert to today's values
4. Wait ~65 seconds — Network tab shows a new `/api/stats?period=...` request fires silently
5. Perform a check-in → metrics refresh; occupancy increases by 1
6. Perform a check-out → metrics refresh; revenue (Dziś) increases by the reservation cost
7. Open `/api/stats?period=day` directly — JSON response with all expected fields
8. Open `/api/stats?period=invalid` — 400 response

## Migration Notes

No database migrations needed. The `reservations.total_cost` column is already populated for all existing records. The `actual_check_out` field is nullable — revenue counts only records where it is non-null and within the selected period.

## References

- Roadmap slice S-02: `context/foundation/roadmap.md`
- Settings pattern (admin client, 503 guard): `src/pages/api/settings.ts`
- Availability endpoint (settings read pattern): `src/pages/api/availability.ts:85`
- Existing MetricCard: `src/components/dashboard/MetricCard.tsx`
- Existing useDashboard: `src/hooks/useDashboard.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Stats API Endpoint

#### Automated

- [x] 1.1 No TypeScript errors: `npm run build`
- [x] 1.2 Linting passes: `npm run lint`

#### Manual

- [ ] 1.3 `GET /api/stats?period=day` returns valid JSON with all 6 numeric fields
- [ ] 1.4 `GET /api/stats?period=month` returns different revenue/count values than day
- [ ] 1.5 `GET /api/stats?period=invalid` returns 400
- [ ] 1.6 `GET /api/stats` (no param) defaults to `period=day` without error

### Phase 2: Dashboard Metrics Update

#### Automated

- [x] 2.1 No TypeScript errors: `npm run build`
- [x] 2.2 Linting passes: `npm run lint` (no new errors; pre-existing errors in unrelated files)

#### Manual

- [ ] 2.3 Dashboard loads with 4 updated metric cards and Dziś/Miesiąc toggle
- [ ] 2.4 Toggling to Miesiąc updates all 4 cards with month values; occupancy value unchanged
- [ ] 2.5 Occupancy card shows percentage + "X wolnych miejsc" subtitle
- [ ] 2.6 Revenue card shows PLN-formatted value with 2 decimal places
- [ ] 2.7 Network tab confirms 60 s polling fires silently
- [ ] 2.8 Check-in/check-out TodayView still works; metrics refresh after operation
