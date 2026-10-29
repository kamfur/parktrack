# Travel Agencies — Plan Brief

> Full plan: `context/changes/travel-agencies/plan.md`
> Research: `context/changes/travel-agencies/research.md`

## What & Why

The parking works with travel agencies that pay for their clients' stays. Staff need to assign reservations to an agency, see per-agency monthly reservations with arrival status and the amount due, and issue one VAT invoice per agency at month end. Today the app has no agency concept, and its invoices are one-per-reservation with no VAT breakdown.

## Starting Point

- Invoices are hard-wired 1:1 to a reservation: gross only, a single-row print, and a racy server-local `MAX+1` numbering.
- A DB trigger reprices reservations on every date or type edit.
- The driver flow resets `is_paid`, and `no_show` cannot be set.
- There are no DB-level tests.

## Desired End State

- Staff manage agencies in Settings and pick an agency on the reservation form.
- The DB then keeps the stay paid and discounted on every path, and drivers see "Biuro podróży – opłacone".
- `/biura-podrozy/[id]?month=` shows the month's reservations, the blocking arrivals, the amount (net/VAT/gross) and the invoice history.
- After month end, one click issues a multi-line VAT invoice in the shared `FV/YYYY/MM/NNN` series, and the invoiced reservations lock.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Money flow | Parking invoices the agency for all its clients; agency reservations are paid | Matches the business arrangement | Grilling |
| What's invoiced | Arrived reservations (`actual_check_in`), billed by planned check-in month | Only delivered service; simple month attribution | Grilling |
| Price | Price list − agency discount %, snapshotted | One setting per agency; no second price list system | Grilling |
| Extensions | Not charged in v1 | Deferred by the user | Grilling |
| Access | Staff-only module | No agency accounts or RLS isolation needed | Grilling |
| Invoice model | Generalize `invoices` + new `invoice_items` (backfilled) | One list, one print, one uniqueness rule per reservation | Plan |
| Legacy invoices | `vat_rate` null → print unchanged; new ones show VAT | Do not alter documents already sent | Plan |
| Numbering | Atomic RPC allocator (advisory lock, Warsaw month, UNIQUE year/month/seq) in Phase 2 | Shared series raises collision risk; fixes the server-local month bug | Research / Plan |
| Discount enforcement | Snapshot % on the reservation; cost trigger on INSERT+UPDATE applies it and forces `is_paid` | Survives date edits by staff, driver or API | Research / Plan |
| No-show | Staff "Nie przyjechał" action → `no_show` | Needed to unblock invoicing; the enum already exists | Research / Plan |
| Invoice dates | Issue = today, sale = last day of month, due = issue + agency term; number by issue month | Standard periodic-service invoicing, chronological numbering | Plan |
| Agency change | Trigger re-snapshots, reprices and derives `is_paid` | Consistent across all write paths | Plan |
| Locks | DB trigger blocks billing-field changes and cancellation on any invoiced reservation, and blocks moving reservations into an invoiced agency-month | Invoices are immutable; nothing silently escapes billing | Grilling / Plan |
| Issuing guard | Month closed + no pending arrivals + one per agency/month | Prevents silent revenue loss | Grilling |
| DB testing | pgTAP + `supabase test db` job in CI | Money rules live in triggers that mocks cannot see | Plan |

## Scope

**In scope:**
- pgTAP harness and CI job
- invoice items, VAT, dates and allocator, with the print rebuilt
- VAT rate setting
- agency CRUD with NIP checksum and archival
- agency on reservations: pricing, payment, driver UI, cost preview
- no-show action
- `/biura-podrozy` module
- monthly agency invoice
- invoice locks
- one e2e path

**Out of scope:** extension charges, correction or void invoices, invoice payment tracking, per-agency API keys, agency portal, email or PDF, statistics and trends, VAT re-render of legacy invoices, GUS/VIES lookup, the driver license-plate trigger bug (separate task).

## Architecture / Approach

Money rules live in Postgres, and the UI mirrors them:

- reservations: lock trigger → driver allowlist trigger → pricing/payment trigger, which fire in alphabetical order;
- `create_invoice` / `create_agency_invoice` RPCs, which share `next_invoice_number()`;
- `agency_month_summary` RPC as the single source for both the preview and the issued invoice.

The TS layers stay thin: zod at the boundary, services map RPC error codes to HTTP. UI follows the price-lists CRUD pattern and the existing detail-page pattern.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. DB test harness | pgTAP suite + CI job | Supabase CLI in GitHub Actions setup |
| 2. Invoice foundation | Items, VAT, atomic numbering, new print; individual invoices unchanged in behavior | Destructive migration of `invoices`; legacy print must match exactly |
| 3. Agencies CRUD | Settings section, API, NIP validation, archive | Low |
| 4. Agency reservations | Discounted, paid-by-agency reservations on all paths; driver UI; no-show | Trigger regressions on non-agency pricing; merge with the license-plate fix |
| 5. Module + monthly invoice | `/biura-podrozy`, issue flow, locks, e2e | Warsaw month boundaries; lock trigger too strict or too loose |

**Prerequisites:**
- Local Supabase (Docker) running.
- The price-lists migration applied.
- A DB backup before deploying Phase 2 to prod.

**Estimated effort:** ~5–7 sessions, one per phase (Phase 2 and Phase 5 are the largest).

## Open Risks & Assumptions

- The Phase 2 migration drops `invoices.reservation_id` and cannot be reversed without a backup. Deploy it alone and verify.
- The lock trigger also applies to individual invoices. That is a behavior change, assumed acceptable because only completed reservations are invoiced.
- The license-plate fix (separate task) and Phase 4 both redefine the driver allowlist trigger, so whichever lands second must merge the two.
- Assumption: the VAT rate is 23% for all parking services, and price lists are gross.
- Staff-created reservations have no agency discount history if an agency is reassigned. The snapshot always comes from the current agency value at assignment.

## Success Criteria (Summary)

- A month-end agency invoice with correct per-line net/VAT/gross can be issued only when every reservation of that month is resolved, and never twice.
- Agency reservations are always paid and discounted, whatever path edits them. Drivers never collect money from agency clients.
- Existing individual invoicing keeps working, and pre-change invoices print exactly as before.
