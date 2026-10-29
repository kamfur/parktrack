# Arrivals Timeline Connect — Plan Brief

> Full plan: `context/changes/arrivals-timeline-connect/plan.md`
> Research: `context/changes/arrivals-timeline-connect/research.md`

## What & Why

Staff and drivers work returns without knowing when the KTW flight lands. v1 shows **scheduled arrival hours** from the public KTW board on existing return lists, bound by saved flight direction and planned return (± about 3h). Several matching hours stay several hours — the app does not pick a flight.

## Starting Point

Departures lists and check-out already work. Direction is free-text `flight_direction`; return is `planned_check_out`. There is no flight API in `src/`. Extra optional JSON keys on list rows are safe; changing envelopes or PATCH bodies is not.

## Desired End State

On staff `/` and driver `/kierowca` Wyjazdy, a matchable direction shows one or more Warsaw clock times from the KTW arrivals board. Empty, legacy `departure`/`arrival`, or unmatched text looks like today. Check-out is unchanged. If the board is down, the list still loads without hours.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Hours source | Live official KTW public board | User chose live public KTW over a repo snapshot | Plan |
| Direction match | Alias table + contains; skip null/legacy | Works on free text without migration | Plan + Research |
| Unmatched rows | No hours, list unchanged | Preserves FR-003/005 | Plan |
| List wiring | Optional `ktw_arrival_hours` on existing lists | Hours on open; envelopes stay | Plan + Research |
| Staff card | Direction + hours | Driver already shows direction | Plan |
| ETA / flight number | Out of v1 | FR-007 / FR-006 nice-to-have | Research / PRD |
| Board failure | Omit hours, keep 200 | Must not break return lists | Plan |
| Window TZ | Europe/Warsaw ±3h on `planned_check_out` | Write paths disagree on TZ | Research |

## Scope

**In scope:** matcher, ±3h window, KTW board adapter (port + fixture tests), enrich staff/driver departure lists, staff+driver UI for hours.

**Out of scope:** ETA/status, flight-number field, picking one flight, other airports, checkout/auth/list filters, prompting for direction, DB migration, paid flight vendors, live HTTP in CI.

## Architecture / Approach

DB query unchanged → one timed fetch of the KTW board per list request → in-memory match (alias + window) → optional `ktw_arrival_hours` on each row → cards read it. Adapter is swappable; tests inject a fake port or a saved board fixture.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Matcher and ±3h window | Pure match + window, unit tests | Weak aliases miss real city spellings |
| 2. Board adapter + enrichment | Live board behind port; fail-soft lists | Board HTML/JSON shape is undocumented and can drift |
| 3. Staff and driver UI | Hours (and staff direction) on return cards | Clutter vs missing context on staff cards |

**Prerequisites:** Reachable KTW public board for manual checks; no new DB.
**Estimated effort:** ~3 sessions / about 1 week after hours (PRD `delivery_weeks: 1`).

## Open Risks & Assumptions

- The public board has no documented API; the adapter may need updating if the page payload changes.
- Alias coverage will miss some free-text values until the table grows.
- “About 3h” is implemented as an inclusive ±3h window.

## Success Criteria (Summary)

- Matchable direction → all candidate KTW hours in the window on staff and driver return views.
- Unmatchable direction and board outage → lists and check-out still work as today.
- No single-flight pick; no checkout contract change.
