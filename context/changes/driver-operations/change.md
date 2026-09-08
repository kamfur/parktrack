---
change_id: driver-operations
title: Mobile driver module for airport parking ops
status: implementing
created: 2026-09-08
updated: 2026-09-08
archived_at: null
---

## Notes

mobile driver module per prd-v2

Research clarifications (2026-09-08):
- Driver lists: operating-window focus — include overdue unconfirmed (e.g. planned 08:00, now 12:00 still visible; also past-day overdue — current RPC drops those).
- Staff dashboard: add cancel-arrival capability is desirable; explicitly NOT for driver module.

Plan decisions (2026-09-08):
- Lists: overdue forever (while confirmed/in_progress) + calendar today; no auto no_show
- Payments: paid_at_arrival / paid_at_departure + surcharge_amount on reservation
- Airport pickup: UI only on in_progress (no new status)
- Sector: free-text; role: app_metadata.role; staff dashboard cancel: separate change
- Driver home path: /kierowca

