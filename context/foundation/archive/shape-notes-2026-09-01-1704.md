---
project: "ParkTrack — Statistics & Invoicing"
version: 1
status: draft
context_type: brownfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  delivery_weeks: 4
  hard_deadline: null
  after_hours_only: true
created: 2026-06-07
updated: 2026-06-07
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6]
  frs_drafted: 14
  gray_areas_resolved:
    - topic: "context type"
      decision: "brownfield — git history (5 commits), package-lock.json, src/"
    - topic: "must preserve"
      decision: "reservations, external API endpoint, email notifications"
    - topic: "change type"
      decision: "two new modules: statistics dashboard + invoice creation"
    - topic: "pricing model"
      decision: "v1: single configurable daily rate. Multi-tier pricing (by spot/season) deferred to v2."
    - topic: "invoice persona"
      decision: "same parking staff — no role separation needed"
    - topic: "invoice output"
      decision: "v1: browser view + print. PDF deferred to v2."
    - topic: "scope"
      decision: "scoped down from full 5-7 week scope; user explicitly chose v1 at 3-4 weeks"
  quality_check_status: accepted
---

## Current System

ParkTrack — web application for parking lot management staff.

**Tech stack:** Astro 5, React 19, TypeScript 5, Tailwind CSS 4, Shadcn/ui, Supabase (PostgreSQL + Auth + RLS + Edge Functions), GitHub Actions CI, Docker on DigitalOcean.

**Current users:** Parking lot management staff (single role, all operations).

**Core functionality today:**
- Reservation management: quick-entry + full details form, search, edit, cancel, no-show
- Parking operations: today's arrivals/departures, check-in (mark In Progress), check-out (mark Completed)
- Reporting: visual occupancy calendar, daily arrival/departure stats
- External API: `POST /reservations` endpoint for external booking systems
- Notifications: automated email confirmation on reservation creation

## Vision & Problem Statement

**What's changing:** Adding two new modules — a statistics dashboard and invoice creation — to extend ParkTrack beyond day-to-day operations into financial visibility and customer billing.

**Why now:** The system has reservation and check-in/out data but no way to turn it into management insights or produce billable documents. Staff currently cannot report on occupancy trends or revenue, and cannot issue invoices from within the system.

**Current workaround:** Manual reports in spreadsheets; invoices issued outside the system.

**What this change enables:** Staff can view occupancy trends and revenue statistics, configure a single daily rate, and generate invoices for customers at check-out.

## User & Persona

**Primary persona:** Parking lot management staff member — handles reservations, daily parking operations, and customer billing. Single role, same person uses all modules.

## Access Control

No access control changes — current model preserved.

Current: Supabase Auth, single staff role, RLS enforced at database level. All authenticated staff have access to all system functions. No role separation.

This change adds statistics and invoicing under the same access model: any logged-in staff member can view statistics and create invoices.

## Functional Requirements

### Statistics

- FR-001: Staff can filter statistics by preset period (last 7 days, last month, this year). Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "free date picker adds complexity — presets cover 90% of use cases." Resolution: changed to presets for v1; custom range deferred to v2.

- FR-002: Staff can view parking occupancy (%) for the selected period. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "occupancy without defined total capacity is meaningless." Resolution: added FR-015 (capacity configuration) as prerequisite.

- FR-003: Staff can view reservation and cancellation counts with trend vs previous period. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "count without context is a number without meaning." Resolution: FR updated to include trend % vs equivalent previous period.

- FR-004: Staff can view revenue totals for the selected period. Priority: must-have. Change: new
  > Socrates: No counter-argument — FR stands as written. Staff understands historical data before pricing config will show as 0.

- FR-005: Staff can view arrival and departure statistics for the selected period. Priority: must-have. Change: new
  > Socrates: No counter-argument — FR stands as written. Trend over a period differs from the existing day-view.

### Invoicing

- FR-007: Staff can configure the daily parking rate (single configurable rate). Priority: must-have. Change: new
  > Socrates: No counter-argument — FR stands as written.

- FR-008: Staff can generate an invoice directly from a completed reservation's detail view. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "separate search module is a redundant step — invoice is always tied to a reservation." Resolution: invoice action moved to reservation detail view; no separate invoicing search module.

- FR-009: Staff can view a generated invoice in the browser for a selected reservation. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "CSS print styles require precision and are hard to get right." Resolution: accepted as v1 compromise; PDF generation deferred to v2.

- FR-010: Staff can enter customer company billing data (name, NIP, address) when creating an invoice. Priority: must-have. Change: new
  > Socrates: No counter-argument — no NIP format validation in v1; staff is responsible for data accuracy.

- FR-011: Staff can print an invoice from the browser. Priority: must-have. Change: new
  > Socrates: No counter-argument — FR stands as written.

### Configuration

- FR-015: Staff can configure total parking capacity (number of spots). Priority: must-have. Change: new
  [Added as resolution to FR-002 Socrates challenge — required for occupancy % to be meaningful.]

### Preserved behavior

- FR-012: Staff can create, edit, and cancel reservations. Priority: must-have. Change: preserved
- FR-013: External systems can create reservations via POST /reservations. Priority: must-have. Change: preserved
- FR-014: System sends email confirmation upon reservation creation. Priority: must-have. Change: preserved

## Non-Goals

- **No PDF invoice generation in v1** — invoices rendered in browser for printing only. PDF deferred to v2. (User selected.)
- **No pricing by spot type or season** — v1 has a single configurable daily rate. Multi-tier pricing deferred to v2. (Decided in Phase 3 scope-down.)
- **No invoice history / archive** — invoices are generated on-demand from the reservation detail view; no persistent invoice list. (Follows from FR-008 design decision.)
- **No statistics CSV export** — statistics visible on-screen only in v1. Export deferred to v2. (Decided in Socrates FR-006.)
- **No custom date range in statistics** — preset periods only (last 7 days, last month, this year). Custom range deferred to v2. (Decided in Socrates FR-001.)
- **No NIP validation** — format validation not implemented in v1; staff is responsible for data accuracy. (Decided in Socrates FR-010.)

## User Stories

### US-01: Staff generates an invoice for a completed stay

- **Given** a completed reservation/stay exists in the system AND the daily rate is configured
- **When** staff opens the reservations module, searches for the completed stay, enters customer company billing data (name, NIP, address), and confirms
- **Then** the system generates an invoice ready to view in the browser and print

#### Acceptance Criteria
- Invoice displays: parking company data (seller), customer company data (buyer), stay dates, number of days, daily rate, total amount
- Staff can print directly from the browser view
- Invoice can only be generated for completed reservations

## Business Logic

System oblicza należną kwotę na podstawie skonfigurowanej stawki dobowej i liczby pełnych dób wynikających z dat rezerwacji.

**Inputs (user-facing):** data zameldowania i wymeldowania z rezerwacji (liczba pełnych dób), skonfigurowana stawka dobowa.

**Output:** łączna kwota brutto wyświetlana na wygenerowanej fakturze.

**User encounter:** kiedy staff inicjuje wystawienie faktury z poziomu zakończonej rezerwacji, system automatycznie oblicza i wyświetla kwotę; staff weryfikuje dane firmy nabywcy i potwierdza przed wydrukiem.

## Non-Functional Requirements

- Statistics queries return results within 3 seconds for any preset period, even when spanning a full year of data.
- Existing operational views (reservations list, check-in/out) must not degrade in response time after this change ships.
- Invoice browser layout must be print-legible: correct margins, readable font sizes, no clipped elements across all major desktop browsers.

## Constraints & Preserved Behavior

- **Historical data:** reservations created before pricing configuration exists have no price — displayed as 0 or '-' in revenue statistics. No backfill required.
- **External API compatibility:** the `POST /reservations` endpoint contract must not change. Any new price-related fields added to the reservation model must be optional/nullable to preserve backward compatibility.
- **Reservation operations:** create, edit, cancel, check-in, check-out flows must not change.
- **Email notifications:** automated confirmation emails on reservation creation must continue working.

## Success Criteria

### Primary
- Staff can open the Statistics module, select a date range, and see all four data dimensions: occupancy, reservation/cancellation counts, revenue, and arrival/departure stats.
- Staff can open the Invoicing module, search for a completed reservation/stay, view the invoice in the browser, and print it.

### Secondary
- Export statistics data to CSV.
- Sequential invoice numbering (e.g. FV/2026/001) — nice-to-have for v1.

### Guardrails
- Reservation creation, editing, and cancellation must work without change.
- External `POST /reservations` API endpoint must remain backward compatible.
- Existing page load times must not degrade — statistics queries must not slow down operational views.
- Email notifications on reservation creation must continue working.

### Timeline
- Scoped v1: ~3–4 weeks after-hours work.
- v2 deferred: PDF download, pricing by spot type/season.

