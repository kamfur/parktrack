# Review fixes — arrivals-timeline-connect

Applied during `/10x-impl-review` triage on 2026-09-16. Unrelated dirty tree was not staged.

## F1 — Plan addendum

Documented accepted product deltas (board status display, 3 nearest hours, 3-day fetch, Madeira alias, PlaneLanding) in `plan.md`.

## F2 — KTW URL allowlist

`assertAllowedKtwArrivalsUrl` rejects non-https / non-KTW hosts; remaps the official board page; fetch uses `redirect: "error"`. Test URL `https://board.test/list` still bypasses via adapter `options.url`.

## F3 — One board fetch for driver lists

`enrichDepartureLists` + `DriverService.listDeparturesWithHandled`. `GET /api/driver/departures` no longer double-fetches the board.

## F4 — Extra hook handlers

Skipped. Split with calendar/driver-ops commits later.

## F5 — Parsed board cap

`MAX_PARSED_BOARD_ROWS = 500` in `parseKatowiceBoardPayload`.
