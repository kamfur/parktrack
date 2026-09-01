---
project: "ParkTrack — Statistics & Invoicing"
version: 1
status: draft
created: 2026-08-30
updated: 2026-08-30
main_goal: low-complexity
top_blocker: decisions
milestone_id: statistics-and-invoicing-mvp
milestone_seq: 1
milestone_status: open
---

## Milestone: M-1 — Statistics and Invoicing MVP

**Outcome:** Staff can configure the parking's daily rate and capacity, view a multi-dimensional statistics dashboard, and generate a printable invoice for any reservation.

**Source:** `context/foundation/prd.md` (FR-001–FR-015, US-01)

---

## Baseline

All baseline layers are present and production-deployed. No foundation slices needed.

- **Frontend:** present — Astro 5 SSR + React 19, Tailwind CSS v4, Shadcn/ui (`src/components/`)
- **Backend/API:** present — Astro API routes under `src/pages/api/`, Zod validation, thin handlers
- **Data:** present — Supabase Postgres, 3 migrations applied to production, RPC functions deployed
- **Auth:** present (DB-level only) — Supabase RLS on `authenticated` role; no application-level auth enforced yet
- **Deploy/infra:** present — Railway Hobby (production at `https://parktrack-production.up.railway.app`), `railway.toml` + `nixpacks.toml` committed
- **Observability:** absent — no structured logging or error tracking; `Railway` dashboard logs suffice for MVP

---

## At a glance

| Change ID | Slice | Status | PRD refs |
|---|---|---|---|
| settings-configuration | S-01: Staff configures daily rate and capacity | in-progress | FR-007, FR-013, FR-015 |
| statistics-dashboard | S-02: Staff views statistics dashboard | in-progress | FR-001, FR-002, FR-003, FR-004, FR-005, FR-012 |
| invoice-generation | S-03: Staff generates and prints invoice | blocked | FR-008, FR-009, FR-010, FR-011, FR-013, FR-014, US-01 |

---

## Slices

### S-01 — Staff configures daily rate and capacity

**Change ID:** `settings-configuration`
**Status:** in-progress
**North star prerequisite:** yes — S-02 reads `daily_rate` from settings; S-03 uses it for invoice total.

**User-visible outcome:** Staff opens a settings page, sets the daily rate (PLN) and total parking capacity, saves, and the values take effect immediately across the app.

**PRD refs:** FR-007 (capacity management), FR-013 (daily rate), FR-015 (settings persistence)

**Scope:**
- Settings page (`/settings`) with a form: daily rate (number, PLN) + total capacity (integer)
- `POST /api/settings` — validate with Zod, upsert to `settings` table
- `GET /api/settings` — return current values
- Values consumed by S-02 (occupancy calc) and S-03 (invoice total)

**Out of scope:** Multi-tier pricing, seasonal rates (parked — see below).

---

### S-02 — Staff views statistics dashboard

**Change ID:** `statistics-dashboard`
**Status:** in-progress
**Stream:** A (after S-01)
**North star:** yes

**User-visible outcome:** Staff opens a dashboard and sees 4 live statistics panels: today's arrivals, today's departures, current occupancy (vs configured capacity), and revenue for the current period.

**PRD refs:** FR-001 (arrivals), FR-002 (departures), FR-003 (occupancy), FR-004 (revenue), FR-005 (dashboard view), FR-012 (real-time refresh)

**Scope:**
- Dashboard page (`/dashboard` or `/`) with 4 stat cards
- Reads from existing Supabase RPC functions: `get_todays_arrivals()`, `get_todays_departures()`
- Occupancy = active reservations / capacity (from S-01 settings)
- Revenue = sum of costs for completed reservations in the current period (day/month toggle)
- Auto-refresh (polling or manual refresh button)

**Out of scope:** Custom date ranges, CSV export, historical charts (parked — see below).

---

### S-03 — Staff generates and prints invoice

**Change ID:** `invoice-generation`
**Status:** blocked
**Stream:** B (independent, but shares daily_rate from S-01)

**User-visible outcome:** Staff selects a completed reservation, fills in the customer's company data, and generates a printable invoice with correct line items and totals.

**PRD refs:** FR-008 (invoice data), FR-009 (invoice generation), FR-010 (print), FR-011 (invoice number), FR-013 (daily rate), FR-014 (cost calculation), US-01

**Unknowns (both blocking):**

1. **Seller data source** — The invoice must show the parking company's name, address, NIP, and bank account. Where does this data come from?
   - Option A: Hardcoded in env vars / config file (simplest MVP)
   - Option B: Editable in the settings page (alongside S-01's rate/capacity fields)
   - Option C: Separate "Company profile" admin section
   - **Owner:** user. **Block:** yes — cannot design the invoice data model or the settings form without this decision.

2. **Full-day billing definition** — FR-014 says cost = `days × daily_rate`. What counts as a "full day"?
   - Option A: Calendar days (check-in day + each subsequent day, check-out day free)
   - Option B: 24-hour periods (any partial 24h = 1 day)
   - Option C: Business rule defined in existing `calculate-cost` logic — confirm what the current API does
   - **Owner:** user. **Block:** yes — the invoice line item description and total depend on this.

**Scope (once unblocked):**
- Invoice generation endpoint: `POST /api/invoices` — accepts reservation ID + customer NIP/name/address, returns invoice data
- Print view: `GET /invoices/[id]/print` — minimal HTML layout optimised for `@media print`
- Sequential invoice numbering (e.g. `FV/2026/001`) — persisted, not computed
- Cost recalculation using the billing-day definition confirmed above

**Out of scope:** PDF generation (browser print → PDF is sufficient for MVP), invoice archive/list view, NIP API validation (parked — see below).

---

## Streams

**Stream A** (north star path): S-01 → S-02
**Stream B** (blocked): S-03 (can be planned in parallel once Open Questions are resolved)

These streams can be executed by separate agent runs. Stream B unblocks independently of Stream A's progress — resolve the two Open Questions and it can start while Stream A is still in flight.

---

## Open Questions

These must be resolved by the user before S-03 can be planned. They do not block S-01 or S-02.

1. **Seller data source** — Where does the parking company's own data (name, address, NIP, bank account) appear on the invoice? Hardcoded config, settings page, or separate admin section? (Blocks: invoice-generation)

2. **Full-day billing definition** — What is a "full day" for the purposes of `cost = days × daily_rate`? Calendar days, 24-hour periods, or something else? (Blocks: invoice-generation)

---

## Parked (out of milestone scope)

These items were identified during decomposition and deliberately excluded from M-1. They are candidates for M-2 or later.

- **PDF generation** — Browser `window.print()` is sufficient for MVP. Full PDF (pdfmake / Puppeteer) adds significant complexity with no proportional user value at this stage.
- **Multi-tier pricing** — Daily rate is flat in M-1. Time-based or vehicle-type tiers belong in a pricing milestone.
- **Invoice archive / list view** — M-1 generates invoices on demand. Browsable history is a M-2 feature.
- **CSV export** — Statistics export not in must-have FRs.
- **Custom date range on dashboard** — Today / current month is sufficient for M-1.
- **NIP (VAT) API validation** — Real-time validation via GUS/VIES adds external dependency; manual entry is fine for MVP.
- **Sequential numbering integrity under concurrency** — Single-user MVP; advisory lock or DB sequence can be added when multi-user write conflicts become real.

---

## Milestone History

_(Populated by /10x-archive when slices complete)_
