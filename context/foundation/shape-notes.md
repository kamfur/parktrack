---
project: "ParkTrack — Driver Operations"
version: 1
status: draft
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
created: 2026-09-01
updated: 2026-09-01
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  frs_drafted: 20
  gray_areas_resolved:
    - topic: "context type"
      decision: "brownfield — git history (21 commits), package-lock.json, src/"
    - topic: "change type"
      decision: "new module — driver views alongside existing staff panel"
    - topic: "insight"
      decision: "mobile-first — driver works on the move; simplified mobile views, not full staff panel"
    - topic: "primary persona"
      decision: "driver only — airport parking driver, single role, mobile access"
    - topic: "auth model"
      decision: "add driver role — Supabase Auth today is single staff role; new driver role with module-scoped access"
    - topic: "driver access scope"
      decision: "driver module only — no invoices, statistics, or full administration"
    - topic: "mvp scope"
      decision: "full seed flow confirmed — arrivals, departures, payments/dopłata, lot occupancy; shift module deferred"
    - topic: "blast radius"
      decision: "reservations + invoices — driver modifies same reservation/payment data as staff"
    - topic: "timeline"
      decision: "~3 weeks after-hours delivery"
  quality_check_status: accepted
seed_idea: |
  jednym z założeń parktrack jest możliwość korzystania jako kierowca parkingu, który jest w stanie widzieć najbliższe przyjazdy oraz wyjazdy w ramach zmiany(moduł zarządzania zmianami też fajnie byłoby zrobić później).
  - Kierowca przy przyjeździe klienta na parkign jest w stanie potwierdzić przyjazd oraz zmienić podstawowe parametry takie jak czas parkowania, jesli by się zmienił oraz zapisać kierunek lotu(tak aby można było monitorować czy samolot się opóźnił - jest to parking przy lotnisku), liczbe pasażerów oraz sektor w którym zaparkowany jest samochód, jest w stanie, zmienić czy zapłacono - wtedy informacja zapłacono u kierowcy po przyjeździe
  - Kierowca otrzymuje telefon, że klienci czekają na podwiezienie na parking po przylocie, w takim razie kierowca powinien widzieć na karcie przyjazdów, nazwisko, rejestracje, liczbe osób oraz kierunek lotu tak aby też wiedział jakim samochodem udać się na lotnisko. Po przywiezieniu pasażerów, jest w stanie odznaczyć wyjazd z parkingu, zapisać notatki oraz przyjąć płatność(z andotacją zapłacone u kierowcy po powrrocie) lub też dopłate jeśli jest wymagana(klient przedłużył pobyt, pierowrny czas powrotu nie zgadza się z rzeczywista dataą powrotu)
  - kierowca powinien widzieć jaki jest obecny stan na parkingu, wraz z listą jakie samochody znajdują się na parkingu
  Widoki te muszą być zooptymalizowane pod urzadzenai mobilnew ponieważ kierowcy często korzystajaz tabletów lub smartfonów
---

## Current System

ParkTrack — web application for parking lot management staff.

**Tech stack:** Astro with Supabase (PostgreSQL, Auth, RLS).

**Current users:** Person operating/managing the parking — handles reservations, daily operations, and billing.

**Core functionality today:**
- Reservation creation and state management with operational views
- Management panel for day-to-day parking operations
- Invoice generation module
- Dashboard and reporting (from prior modules)

## Vision & Problem Statement

**What's changing:** A new driver operations module alongside the existing staff panel — mobile-optimized views for airport parking drivers to handle arrivals, departures, on-lot status, and field payments.

**Why now:** Drivers work on the move (tablets/smartphones) and need a simplified operational surface — not the full management panel. Current ParkTrack serves staff who manage reservations and invoices; drivers need focused flows for confirming arrivals, picking up passengers after landing, recording departures, and seeing current lot occupancy.

**Current workaround:** Drivers likely use the staff panel on mobile (poor fit) or operate outside the system (phone calls, paper, verbal handoffs).

**What this change enables:** Drivers can see upcoming arrivals/departures for their shift context, confirm and update reservation details at arrival, respond to pickup calls with the right vehicle info, complete departures with notes and payment/dopłata, and view live parking occupancy — all from mobile-optimized screens.

**Deferred:** Shift management module (assigning drivers to shifts, shift-scoped views) — planned for a later phase.

## User & Persona

**Primary persona:** Airport parking driver — operates on tablet or smartphone during shifts. Confirms customer arrivals on the lot, drives to the airport for passenger pickup after phone notification, completes departures and collects payment. Does not need access to full staff administration (invoicing dashboard, statistics, reservation admin beyond their operational tasks).

## Access Control

**Current model:** Supabase Auth with a single staff role. All authenticated users see all system functions (reservations, management panel, invoices, dashboard). RLS enforced at database level.

**Planned changes:**
- Add a **driver** role alongside existing staff.
- Drivers authenticate via the same Supabase Auth flow but are routed to the driver module only.
- Drivers cannot access: invoice generation, statistics dashboard, full reservation administration, or staff management panel.
- Staff role preserved unchanged — existing staff users retain full access.

**Smallest useful access model:** Two roles — `staff` (full access, unchanged) and `driver` (driver module only). No additional role granularity in v1.

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

## Functional Requirements

### Authentication & access

- FR-001: Driver can log in and access only the driver module. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "same login with different UI routing might suffice without a new role." Resolution: kept driver role — module-only access boundary (no invoices/stats/admin) requires RBAC, not just UI routing.
- FR-002: Staff can continue using all existing modules unchanged. Priority: must-have. Change: preserved
  > Socrates: No counter-argument; FR stands as written.

### Arrivals

- FR-003: Driver can view a list of upcoming arrivals. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "staff already has an arrivals list — duplication." Resolution: kept — driver list is a mobile field-ops view for in-shift actions, not staff admin duplication.
- FR-004: Driver can confirm customer arrival. Priority: must-have. Change: new
  > Socrates: No counter-argument; FR stands as written.
- FR-005: Driver can update parking duration at arrival if it changed. Priority: must-have. Change: modified
  > Socrates: No counter-argument; FR stands as written.
- FR-006: Driver can record flight direction at arrival. Priority: must-have. Change: new
  > Socrates: No counter-argument; FR stands as written.
- FR-007: Driver can record passenger count at arrival. Priority: must-have. Change: modified
  > Socrates: No counter-argument; FR stands as written.
- FR-008: Driver can record parking sector at arrival. Priority: must-have. Change: new
  > Socrates: No counter-argument; FR stands as written.
- FR-009: Driver can mark paid-at-arrival status on the reservation. Priority: must-have. Change: modified
  > Socrates: No counter-argument; FR stands as written.

### Departures & airport pickup

- FR-010: Driver can view a list of upcoming departures. Priority: must-have. Change: new
  > Socrates: No counter-argument; FR stands as written.
- FR-011: Driver can view an arrival/departure card with surname, registration, passenger count, and flight direction for airport pickup. Priority: must-have. Change: new
  > Socrates: No counter-argument; FR stands as written.
- FR-012: Driver can mark departure complete after returning the customer. Priority: must-have. Change: modified
  > Socrates: No counter-argument; FR stands as written.
- FR-013: Driver can add notes on departure. Priority: must-have. Change: modified
  > Socrates: No counter-argument; FR stands as written.
- FR-014: Driver can record payment at departure. Priority: must-have. Change: modified
  > Socrates: No counter-argument; FR stands as written.
- FR-015: Driver can record dopłata when actual return differs from planned (extended stay). Priority: must-have. Change: modified
  > Socrates: No counter-argument; FR stands as written.

### Lot occupancy

- FR-016: Driver can view current lot occupancy with a list of vehicles on the parking lot. Priority: must-have. Change: new
  > Socrates: No counter-argument; FR stands as written.

### Mobile UX

- FR-017: Driver module views are optimized for tablet and smartphone use. Priority: must-have. Change: new
  > Socrates: No counter-argument; FR stands as written.

### Preserved staff capabilities

- FR-018: Staff can create reservations. Priority: must-have. Change: preserved
  > Socrates: Counter-argument considered: "driver should also create ad-hoc reservations in the field." Resolution: v1 preserves staff-only creation; ad-hoc driver reservations deferred — see Open Questions.
- FR-019: Staff can use the dashboard. Priority: must-have. Change: preserved
  > Socrates: No counter-argument; FR stands as written.
- FR-020: Staff can generate invoices. Priority: must-have. Change: preserved
  > Socrates: No counter-argument; FR stands as written.

## User Stories

### US-01: Driver confirms customer arrival at parking lot

- **Given** a logged-in driver with an upcoming arrival reservation visible on the arrivals list
- **When** the customer arrives on the parking lot and the driver opens the arrival card
- **Then** the driver can confirm the arrival and update parking duration (if changed), flight direction, passenger count, parking sector, and paid-at-arrival status

#### Acceptance Criteria

- Confirmed arrival updates reservation state visible to staff in the existing panel
- All fields editable on a single mobile-friendly arrival card
- Paid-at-arrival flag is recorded and visible on the reservation for staff/invoice context
- Driver cannot access staff-only modules after confirming arrival

## Business Logic

**One-sentence rule:** ParkTrack drives each airport parking reservation through an explicit operational workflow — expected → on lot → airport pickup → completed — with driver field actions updating the same reservation record that staff and invoicing rely on.

**Supporting detail:**
- **Inputs:** reservation details (customer, vehicle, planned dates), flight direction, passenger count, parking sector, payment events (at arrival, at departure, dopłata for extended stay), driver notes.
- **Output:** reservation state transitions visible to both driver (mobile module) and staff (existing panel); payment flags flow through to invoice context without duplicate entry.
- **User encounter:** Driver sees state-appropriate actions on mobile cards (confirm arrival while expected, pickup card after phone notification, departure + payment when customer returns). Staff sees the updated state in existing views.

**Change classification:** Adds a new domain rule — driver field operations participate in the reservation workflow alongside staff. Existing staff-only transitions are extended, not replaced.

## Non-Functional Requirements

- Driver module remains fully usable on tablet and smartphone screen sizes without requiring zoom or horizontal pan for core operational tasks (arrival confirm, pickup card, departure, lot list).
- Driver-recorded state and payment changes appear in staff views without manual re-entry (single source of truth).

## Constraints & Preserved Behavior

**Must preserve:**
- Reservation creation flow for staff
- Dashboard module
- Invoice generation module
- Same reservation and payment data store — no duplicate records for driver vs staff actions

**Integration constraints:**
- Driver and staff operate on the same reservation entities; changes by either role must be consistent for invoicing.

**Backward compatibility:**
- Existing staff users and workflows continue unchanged; driver module is additive.

**Deferred (later phases):**
- Shift management module (shift-scoped arrival/departure lists)
- Ad-hoc reservation creation by driver in the field (raised in Socrates FR-018)
- Automated flight delay monitoring

## Non-Goals

- **Shift management module in v1** — driver sees upcoming arrivals/departures without shift assignment/scoping; shift module is a later phase.

## Open Questions

- Should drivers be able to create ad-hoc reservations in the field? (Raised in Socrates FR-018; deferred from v1.)

## Quality cross-check

All required elements present at shape completion (2026-09-01):

- Access Control: present — driver role with module-scoped access
- Business Logic: present — workflow state rule (expected → on lot → pickup → completed)
- Project artifacts: present — shape-notes.md with valid checkpoint
- Timeline-cost ack: present — 3-week delivery_weeks within default target
- Non-Goals: present — shift module deferred from v1
- Preserved behavior: present — Constraints & Preserved Behavior section names staff flows and shared data store
