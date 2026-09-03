---
change_id: testing-settings-stats
title: Settings admin client and stats correctness tests
status: implemented
created: 2026-09-02
updated: 2026-09-03

archived_at: null
---

## Notes

Open a change folder for rollout Phase 3 of context/foundation/test-plan.md: "Settings admin client + stats correctness". Risks covered: Risk #3 (settings write fails silently when service role key absent — RLS blocks anon client, PATCH returns 200 but nothing persists), Risk #6 (revenue stats display wrong month total at month-end — Warsaw timezone clause dropped in future stats query touch). Test types planned: integration. Risk response intent: Risk #3 — prove that a settings write with the wrong/absent client key surfaces a visible error rather than silent success; challenge the assumption that a 200 response means the value persisted; avoid happy-path-only tests that never exercise the RLS-blocked path. Risk #6 — prove that the monthly stats boundary is Warsaw-timezone-aware; challenge the assumption that UTC midnight equals Warsaw month boundary; avoid asserting current output without an independent timezone oracle.
