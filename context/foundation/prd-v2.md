---
project: "ParkTrack — Driver Operations"
version: 2
status: draft
created: 2026-09-01
context_type: brownfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  delivery_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

## Current System Overview

ParkTrack — web application for parking lot management staff.

**System purpose:** Manage airport parking reservations, daily operations, and customer billing for parking lot staff.

**Key architecture:** Server-rendered web application with interactive client islands.

**Tech stack:** Astro with Supabase (PostgreSQL, Auth, RLS).

**Current user base:** Person operating/managing the parking — handles reservations, daily operations, and billing. Small scale (single parking operation).

**Core functionality today:**
- Reservation creation and state management with operational views
- Management panel for day-to-day parking operations
- Invoice generation module
- Dashboard and reporting (from prior modules)

## Problem Statement & Motivation

**The gap:** ParkTrack serves staff who manage reservations and invoices, but airport parking drivers who work on the move (tablets/smartphones) have no dedicated operational surface. They need focused flows for confirming arrivals, picking up passengers after landing, recording departures, and seeing current lot occupancy — not the full management panel.

**Why now:** Drivers work in the field during shifts. The existing staff panel is a poor fit on mobile devices; drivers likely use it awkwardly or operate outside the system (phone calls, paper, verbal handoffs).

**Current workaround:** Drivers use the staff panel on mobile (poor fit) or bypass the system entirely.

**What this change enables:** A new driver operations module with mobile-optimized views. Drivers can see upcoming arrivals/departures, confirm and update reservation details at arrival, respond to pickup calls with the right vehicle info, complete departures with notes and payment/dopłata, and view live parking occupancy.

**Deferred:** Shift management module (assigning drivers to shifts, shift-scoped views) — planned for a later phase.

## User & Persona

**Primary persona (new):** Airport parking driver — operates on tablet or smartphone during shifts. Confirms customer arrivals on the lot, drives to the airport for passenger pickup after phone notification, completes departures and collects payment. Does not need access to full staff administration (invoicing dashboard, statistics, reservation admin beyond operational tasks).

**Existing users affected:** Parking lot management staff — experience unchanged in v1. Staff continue using reservation creation, dashboard, and invoice module. Driver field actions update the same reservation records staff rely on.

**User base change:** Staff (unchanged) plus drivers (estimated 2–10 users per parking operation).

## Success Criteria

### Primary

Driver can complete a full operational cycle on mobile without using the staff panel:

1. Log in on tablet/smartphone → land on driver module (not staff panel)
2. See upcoming arrivals and departures list
3. At customer arrival: confirm arrival, adjust parking duration if changed, record flight direction, passenger count, parking sector, and paid-at-arrival status
4. After phone notification for airport pickup: view arrival card with surname, registration, passenger count, flight direction → drive to airport
5. After returning customer: mark departure, add notes, collect payment or dopłata (e.g. extended stay vs. original return date)
6. At any time: view current lot occupancy — list of vehicles on the parking lot

### Secondary

- Staff can continue using reservation creation, dashboard, and invoice module unchanged while drivers use the new module in parallel.

### Guardrails

- Reservation creation flow for staff must not break.
- Dashboard and invoice module must remain functional and consistent with driver-recorded payment data.
- External reservation API and email notifications (if present) must continue working.
- Driver role cannot access staff-only modules (invoices, statistics, full admin).
- Mobile views must be usable on tablet and smartphone screen sizes.
- Driver module remains fully usable on tablet and smartphone screen sizes without requiring zoom or horizontal pan for core operational tasks (arrival confirm, pickup card, departure, lot list).
- Driver-recorded state and payment changes appear in staff views without manual re-entry (single source of truth).

## User Stories

### US-01: Driver confirms customer arrival at parking lot

**Before:** Staff confirmed arrivals through the management panel; drivers had no dedicated field workflow.

- **Given** a logged-in driver with an upcoming arrival reservation visible on the arrivals list
- **When** the customer arrives on the parking lot and the driver opens the arrival card
- **Then** the driver can confirm the arrival and update parking duration (if changed), flight direction, passenger count, parking sector, and paid-at-arrival status

#### Acceptance Criteria

- Confirmed arrival updates reservation state visible to staff in the existing panel
- All fields editable on a single mobile-friendly arrival card
- Paid-at-arrival flag is recorded and visible on the reservation for staff/invoice context
- Driver cannot access staff-only modules after confirming arrival

## Scope of Change

### Authentication & access

- [new] Driver can log in and access only the driver module. Priority: must-have.
  > Socrates: Counter-argument considered: "same login with different UI routing might suffice without a new role." Resolution: kept driver role — module-only access boundary (no invoices/stats/admin) requires role-based access, not just UI routing.
- [preserved] Staff can continue using all existing modules unchanged. Priority: must-have.

### Arrivals

- [new] Driver can view a list of upcoming arrivals. Priority: must-have.
  > Socrates: Counter-argument considered: "staff already has an arrivals list — duplication." Resolution: kept — driver list is a mobile field-ops view for in-shift actions, not staff admin duplication.
- [new] Driver can confirm customer arrival. Priority: must-have.
- [modified] Driver can update parking duration at arrival if it changed. Priority: must-have.
- [new] Driver can record flight direction at arrival. Priority: must-have.
- [modified] Driver can record passenger count at arrival. Priority: must-have.
- [new] Driver can record parking sector at arrival. Priority: must-have.
- [modified] Driver can mark paid-at-arrival status on the reservation. Priority: must-have.

### Departures & airport pickup

- [new] Driver can view a list of upcoming departures. Priority: must-have.
- [new] Driver can view an arrival/departure card with surname, registration, passenger count, and flight direction for airport pickup. Priority: must-have.
- [modified] Driver can mark departure complete after returning the customer. Priority: must-have.
- [modified] Driver can add notes on departure. Priority: must-have.
- [modified] Driver can record payment at departure. Priority: must-have.
- [modified] Driver can record dopłata when actual return differs from planned (extended stay). Priority: must-have.

### Lot occupancy

- [new] Driver can view current lot occupancy with a list of vehicles on the parking lot. Priority: must-have.

### Mobile UX

- [new] Driver module views are optimized for tablet and smartphone use. Priority: must-have.

### Preserved staff capabilities

- [preserved] Staff can create reservations. Priority: must-have.
  > Socrates: Counter-argument considered: "driver should also create ad-hoc reservations in the field." Resolution: v1 preserves staff-only creation; ad-hoc driver reservations deferred — see Open Questions.
- [preserved] Staff can use the dashboard. Priority: must-have.
- [preserved] Staff can generate invoices. Priority: must-have.

## Constraints & Compatibility

**Must preserve:**
- Reservation creation flow for staff
- Dashboard module
- Invoice generation module
- Same reservation and payment data store — no duplicate records for driver vs staff actions

**Integration constraints:**
- Driver and staff operate on the same reservation entities; changes by either role must be consistent for invoicing.
- External reservation API and email notifications (if present) must continue working unchanged.

**Backward compatibility:**
- Existing staff users and workflows continue unchanged; driver module is additive.
- No breaking changes to staff-facing URLs or workflows in v1.

**Deferred (later phases):**
- Shift management module (shift-scoped arrival/departure lists)
- Ad-hoc reservation creation by driver in the field (raised in Socrates FR-018)
- Automated flight delay monitoring

## Business Logic Changes

**One-sentence rule (new):** ParkTrack drives each airport parking reservation through an explicit operational workflow — expected → on lot → airport pickup → completed — with driver field actions updating the same reservation record that staff and invoicing rely on.

**Supporting detail:**
- **Inputs:** reservation details (customer, vehicle, planned dates), flight direction, passenger count, parking sector, payment events (at arrival, at departure, dopłata for extended stay), driver notes.
- **Output:** reservation state transitions visible to both driver (mobile module) and staff (existing panel); payment flags flow through to invoice context without duplicate entry.
- **User encounter:** Driver sees state-appropriate actions on mobile cards (confirm arrival while expected, pickup card after phone notification, departure + payment when customer returns). Staff sees the updated state in existing views.

**Change classification:** Adds a new domain rule — driver field operations participate in the reservation workflow alongside staff. Existing staff-only transitions are extended, not replaced.

## Access Control Changes

**Current model:** Authenticated login with a single staff role. All authenticated users see all system functions (reservations, management panel, invoices, dashboard). Access enforced at the data layer.

**Planned changes:**
- Add a **driver** role alongside existing staff.
- Drivers authenticate via the same login flow but are routed to the driver module only.
- Drivers cannot access: invoice generation, statistics dashboard, full reservation administration, or staff management panel.
- Staff role preserved unchanged — existing staff users retain full access.

**Smallest useful access model:** Two roles — `staff` (full access, unchanged) and `driver` (driver module only). No additional role granularity in v1.

## Non-Goals

- **Shift management module in v1** — driver sees upcoming arrivals/departures without shift assignment/scoping; shift module is a later phase.
- **Automated flight delay monitoring in v1** — flight direction is recorded at arrival; external flight-status integration deferred.
- **Driver access to invoices, statistics, or full administration in v1** — driver module is operational-only.
- **Offline-first operation in v1** — driver module requires network connectivity.

## Open Questions

1. **Should drivers be able to create ad-hoc reservations in the field?** — Raised in Socrates FR-018; deferred from v1. Owner: product. Resolution needed before v2 or if field walk-ins become a frequent pain point.
