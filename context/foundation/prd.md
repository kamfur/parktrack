---
project: "ParkTrack — Statistics & Invoicing"
version: 1
status: draft
created: 2026-06-07
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
---

## Current System Overview

ParkTrack is a web application for parking lot management staff. It handles the full reservation lifecycle — from creation and check-in to check-out — for a single parking facility.

**Architecture:** Server-rendered web application with interactive islands, backed by a hosted PostgreSQL database with built-in authentication and row-level security. Deployed via container on a cloud VM.

**Tech stack:** Astro 5, React 19, TypeScript 5, Tailwind CSS 4, Shadcn/ui, Supabase (PostgreSQL + Auth + RLS + Edge Functions), GitHub Actions CI, Docker on DigitalOcean.

**Current user base:** Parking lot management staff (1–10 users); single role; all authenticated users have access to all functions.

**Core functionality today:**
- Reservation management: quick-entry and full-details form, search, edit, cancel, no-show
- Parking operations: today's arrivals/departures views, check-in (mark In Progress), check-out (mark Completed)
- Reporting: visual occupancy calendar, daily arrival/departure statistics
- External API: endpoint for external systems to create reservations
- Notifications: automated email confirmation on reservation creation

## Problem Statement & Motivation

Parking lot staff have access to operational data — reservations, check-ins, check-outs — but no way to turn that data into management insights or billable documents. Revenue tracking requires manual spreadsheet work outside the system, and invoices for customers must be created in a separate tool.

This change adds two capabilities: a statistics dashboard to surface occupancy and revenue trends, and invoice generation triggered directly from a completed reservation. Both are needed before the system can support a full end-to-end billing workflow.

**Current workaround cost:** Staff export or manually reconstruct occupancy and revenue data in spreadsheets; invoices are created manually in an external tool, disconnected from reservation data.

## User & Persona

**Primary persona:** Parking lot management staff member — responsible for daily operations (reservations, arrivals, departures) and customer billing. A single role handles all tasks from reservation creation through invoice generation. The trigger for using the new modules: end of a customer's stay (invoice) or end-of-period management review (statistics).

## Success Criteria

### Primary
- Staff can open the Statistics module, select a preset period, and see all four data dimensions: parking occupancy (%), reservation and cancellation counts with trend vs previous period, revenue totals, and arrival/departure statistics.
- Staff can open a completed reservation's detail view, enter customer company billing data, and generate an invoice ready to view in the browser and print.

### Secondary
- Statistics data can be exported to CSV.
- Generated invoices carry a sequential invoice number (e.g. FV/2026/001).

### Guardrails
- Reservation creation, editing, and cancellation must work without change after this change ships.
- The external reservation creation API must remain backward compatible — existing external consumers must not break.
- Existing operational views (reservations list, arrivals/departures) must not degrade in response time.
- Automated email confirmation on reservation creation must continue working.

### Adjacent (QR confirmation — S-04)

- After a reservation is created, the guest (or staff acting for them) can see a confirmation that includes the reservation number and a QR code.
- At arrival, staff or a driver can scan that QR code to open the matching reservation without searching the list.

## User Stories

### US-01: Staff generates an invoice for a completed stay

- **Given** a completed reservation/stay exists in the system AND the daily rate is configured
- **When** staff opens the reservations module, finds the completed stay, enters customer company billing data (name, NIP, address), and confirms
- **Then** the system generates an invoice ready to view in the browser and print

#### Acceptance Criteria
- Invoice displays: parking company data (seller), customer company data (buyer), stay dates, number of days, daily rate, total amount
- Staff can print directly from the browser view
- Invoice can only be generated for completed reservations

### US-02: Guest confirmation includes a QR code; ops can open the reservation by scan

- **Given** a reservation has just been created (staff form or external API)
- **When** the confirmation is shown (and emailed, if email confirmation is already sent)
- **Then** the confirmation includes the reservation number and a QR code that uniquely identifies that reservation
- **And when** staff or a driver scans the QR at arrival
- **Then** the matching reservation opens so they can continue check-in without searching the list

#### Acceptance Criteria
- QR is generated for every new reservation and remains stable for that reservation
- Confirmation UI shows reservation number + QR; existing email confirmation continues to send
- Scanning the QR opens the correct reservation for the current role (staff detail or driver arrival card)
- Invalid or unknown QR does not mutate reservation state; user sees a clear error
- Scan is additive: list search and existing check-in remain available

## Scope of Change

### New capabilities

- [new] Staff can filter statistics by preset period (last 7 days, last month, this year)
  > Socrates: Counter-argument considered: "free date picker adds complexity — presets cover 90% of use cases." Resolution: presets for v1; custom range deferred to v2.

- [new] Staff can view parking occupancy (%) for the selected period — requires total parking capacity to be configured (see FR-015 equivalent below)
  > Socrates: Counter-argument considered: "occupancy without defined total capacity is meaningless." Resolution: capacity configuration added as prerequisite.

- [new] Staff can view reservation and cancellation counts with trend vs previous equivalent period
  > Socrates: Counter-argument considered: "count without context is a number without meaning." Resolution: trend % vs equivalent previous period included.

- [new] Staff can view revenue totals for the selected period
  > Socrates: No counter-argument. Staff understands that records without a configured price show as zero.

- [new] Staff can view arrival and departure statistics for the selected period
  > Socrates: No counter-argument. Trend over a period differs from the existing day-view.

- [new] Staff can configure the daily parking rate (single globally configurable rate)
  > Socrates: No counter-argument.

- [new] Staff can configure total parking capacity (number of spots) — prerequisite for occupancy (%)

- [new] Staff can generate an invoice directly from a completed reservation's detail view
  > Socrates: Counter-argument considered: "a separate search module is a redundant step — invoice is always tied to a reservation." Resolution: invoice action placed in reservation detail view; no separate invoicing module.

- [new] Staff can enter customer company billing data (name, NIP, address) when creating an invoice
  > Socrates: No counter-argument — no NIP format validation in v1; staff is responsible for data accuracy.

- [new] Staff can view a generated invoice in the browser
  > Socrates: Counter-argument considered: "print-from-browser requires precision in print layout." Resolution: accepted as v1 compromise; PDF generation deferred to v2.

- [new] Staff can print an invoice from the browser

- [new] Guest/staff confirmation after reservation create includes a reservation number and QR code (FR-016)
- [new] Staff or driver can scan the reservation QR at arrival to open that reservation (FR-017)

### Preserved capabilities

- [preserved] Staff can create, edit, and cancel reservations — must not change
- [preserved] External systems can create reservations via the external reservation API — must not break
- [preserved] Automated email confirmation is sent on reservation creation — must not change

## Constraints & Compatibility

**Backward compatibility:** The external reservation creation API contract must not change. Any additions to reservation records to support pricing must not break existing API consumers — new fields must remain ignorable by existing consumers.

**Historical data:** Reservations created before pricing is configured carry no price. These appear as zero revenue in statistics. No migration is required; staff are aware that historical revenue data reflects only records with a configured price.

**Existing integrations:** Automated email notifications on reservation creation must continue to function without change.

**Preserved behavior:** The full reservation lifecycle (create, edit, cancel, check-in, check-out) and all existing operational views must remain functionally and performance-equivalent after this change ships.

## Business Logic Changes

This change adds one new domain rule:

The system calculates the amount due for a completed stay as the product of the number of full days between check-in and check-out dates and the configured daily rate.

**Inputs (user-facing):** check-in date and check-out date from the reservation (number of full days derived), and the globally configured daily rate.

**Output:** the total gross amount displayed on the generated invoice.

**User encounter:** when staff initiates invoice generation from a completed reservation's detail view, the system automatically calculates and displays the total; staff reviews, enters customer company billing data, and confirms before printing.

The existing system has no domain calculation rule — all prior functionality is record management. This rule is additive; it does not modify or replace any existing logic.

## Access Control Changes

No access control changes — current model preserved.

Any authenticated staff member can access the statistics dashboard and generate invoices, consistent with the existing flat-access model where all authenticated staff have access to all system functions.

## Non-Goals

- **No PDF invoice generation in v1** — invoices are rendered in the browser for printing only. PDF generation deferred to v2.
- **No pricing by spot type or season** — v1 supports a single globally configurable daily rate. Multi-tier pricing deferred to v2.
- **No invoice history or archive** — invoices are generated on-demand from the reservation detail view; no persistent invoice list is maintained.
- **No statistics CSV export** — statistics are visible on-screen only in v1. Export deferred to v2.
- **No custom date range in statistics** — preset periods only (last 7 days, last month, this year). Custom range deferred to v2.
- **No NIP format validation** — staff is responsible for the accuracy of customer billing data entered during invoice generation.
- **No hardware gate/barrier integration from QR** — scan opens the reservation in the app; it does not open a boom barrier or third-party access control.

## Open Questions

1. **Where does the seller (parking company) data on the invoice come from?** The invoice must display the parking company's name, address, and NIP as the seller. Is this configured once in system settings, or entered manually each time? Owner: user. Block: yes — invoice cannot be generated without a defined seller.
2. **What constitutes a "full day" for billing purposes?** Does a check-in on day 1 and check-out on day 2 count as 1 day or 2? Is a minimum of 1 day charged regardless of actual hours? Owner: user. Block: yes — the billing calculation rule is ambiguous without this definition.
