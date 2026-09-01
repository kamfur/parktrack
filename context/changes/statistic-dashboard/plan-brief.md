# Statistics Dashboard — Plan Brief

> Full plan: `context/changes/statistic-dashboard/plan.md`

## What & Why

S-02 adds a revenue metric, an occupancy panel, and a period toggle to the existing dashboard at `/`. The current 4-card layout shows operational counts (available spots, total reservations, arrivals, departures) but has no financial visibility. Staff need to see how much revenue was earned today and this month without leaving the dashboard.

## Starting Point

The dashboard at `/` already renders 4 metric cards and a TodayView (check-in/check-out lists) via `useDashboard` + `DashboardContainer`. Metrics are computed client-side from the arrivals/departures list arrays fetched on mount — no stats API, no polling, no period toggle. `reservations.total_cost` is stored and ready to aggregate.

## Desired End State

Staff see 4 updated panels — Arrivals, Departures, Occupancy (% + free spots), Revenue (PLN) — with a Dziś/Miesiąc toggle above them. Switching periods instantly refetches from the server. Data refreshes silently every 60 seconds. The TodayView check-in/check-out workflow below is untouched.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Dashboard location | Extend `/` (not new page) | Roadmap specifies `/dashboard` or `/`; existing page is already the operational hub | Roadmap |
| 4 metric cards | Replace existing 4 | Cleaner than 5-card layout; S-02 metrics supersede the old ones | Plan |
| Occupancy display | % primary + "X wolnych" subtitle | Gives both the rate and the absolute free-spots count staff need to act | Plan |
| Revenue date field | `actual_check_out` | Revenue is real only when the car has left — no counting wishful revenue | Plan |
| Revenue scope | `status='completed'` only | Avoids mixing committed vs earned; staff see what's actually been paid out | Plan |
| Period toggle | Global (all 4 cards) | User preference; occupancy is period-invariant and renders the same either way | Plan |
| Refresh | 60 s polling | Low server load (1 req/min); no user action needed; WebSocket is overkill for MVP | Plan |
| Stats aggregation | New `/api/stats?period=` endpoint | Single round trip; server-side aggregation avoids large client-side dataset | Plan |

## Scope

**In scope:**
- New `GET /api/stats?period=day|month` endpoint
- Global Day/Month toggle in MetricsSection
- Arrivals, Departures, Occupancy, Revenue metric cards (replace existing 4)
- MetricCard subtitle slot for occupancy
- 60 s polling in useDashboard
- `StatsPeriod` + `StatsData` types in types.ts

**Out of scope:**
- Historical charts or daily breakdowns (M-2)
- CSV export
- Custom date range picker
- Real-time WebSocket
- Separate `/statystyki` page
- Revenue for `in_progress` reservations

## Architecture / Approach

The new `/api/stats` endpoint runs four parallel Supabase queries using the admin client, applies period scoping server-side (Warsaw timezone truncation), and returns a flat JSON object. The `useDashboard` hook adds a fourth parallel fetch for stats alongside the existing arrivals/departures list fetches, exposes `period`/`setPeriod`, and sets up a 60 s interval. MetricsSection becomes a controlled component that receives stats + period + onPeriodChange as props.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Stats API | `GET /api/stats?period=day\|month` returns all 4 metric values | Timezone handling for month boundary (Warsaw vs UTC) |
| 2. Dashboard update | Updated cards, period toggle, polling | Not breaking check-in/check-out TodayView during MetricsSection refactor |

**Prerequisites:** S-01 `settings-configuration` must be merged so `daily_rate` and `total_parking_spots` are present in the settings table. The admin client pattern (`createSupabaseAdminClient`) is already established.

**Estimated effort:** ~2 sessions across 2 phases

## Open Risks & Assumptions

- Timezone: the plan uses `AT TIME ZONE 'Europe/Warsaw'` — if the DB server timezone is already set to Warsaw, double conversion is harmless but redundant. Verify once.
- `actual_check_out` is NULL for in-progress reservations, so Day revenue will be low until end of day (by design — this is what "completed only" means).
- The `get_todays_arrivals()` RPC returns reservations for the nearest upcoming check-in date, which may not be today if there are no arrivals today. The stats endpoint queries the `reservations` table directly for exact date matching, which may produce a different count than the TodayView list — this is intentional and expected.

## Success Criteria (Summary)

- `GET /api/stats?period=day` returns valid JSON with all 6 fields; `?period=month` returns different values
- Dashboard shows 4 updated cards with working Day/Month toggle and correct PLN revenue formatting
- Network tab confirms 60 s polling and no console errors after 5 minutes of use
