---
project: "ParkTrack — Garage & Carport Slots"
version: 5
status: draft
created: 2026-09-21
context_type: brownfield
product_type: web-app
target_scale:
  users: small
timeline_budget:
  delivery_weeks: 2
  hard_deadline: null
  after_hours_only: true
---

## Current System Overview

ParkTrack is a web application for airport parking-lot management staff and drivers, handling the full reservation lifecycle for a single parking facility.

**Tech stack:** Astro, React, TypeScript, Shadcn/ui, Supabase (PostgreSQL) — routes in `src/pages`/`src/pages/api`, domain logic in `src/lib/services`.

**Current user base:** staff and drivers (small scale, single site).

**Core functionality today:** regular (open-air) parking-spot reservations, dashboard (arrivals/departures), driver operations views, and a calendar view. The system has no concept of a garage or carport as a spot type.

## Problem Statement & Motivation

The parking facility also has garage and carport spots, which today have no representation in the system. A garage/carport has its own capacity (single or double), its own price list, and a staff allocation concern that regular spots don't have: reservations must be assigned to a specific garage/carport without creating too much idle downtime between vehicles, while always keeping a minimum 10-hour buffer in case a return flight is delayed.

# TODO: why now (trigger event / business pressure driving this change now) — see Open Questions
# TODO: current workaround and its cost (how staff handle garage/carport allocation today, before this system support exists) — see Open Questions

## User & Persona

**Staff** — configures garage/carport spots (type, capacity, price list, availability), manages allocation and manual swaps, and uses the optimization-suggestion view.

**Driver** — sees the assigned garage/carport and spot on their existing driver view; no new capability, only new information surfaced.

Moment: staff allocates/reorganizes garage reservations to avoid downtime while preserving the 10h buffer; both driver and staff see the garage assignment wherever a reservation is already shown (reservation, dashboard, driver, calendar, details).

## Success Criteria

### Primary

- Staff opens the garage/carport configurator and defines a spot (type: garage/carport, single/double, price list, available checkbox). When creating/editing a reservation that needs a garage, the system auto-assigns an available garage/carport respecting a minimum 10h buffer against a delayed return flight. The assigned garage and spot are visible (icon + info) on the reservation, dashboard, driver, and calendar views; the details view shows the garage description plus assigned spot.
- Staff opens a time × garage-spot view, sees reserved garage spots, and can manually swap an assignment.
- Staff clicks "suggest optimization" and sees a descriptive proposal for swaps that reduce downtime (no auto-execution).

### Secondary

- An algorithm that itself checks availability and automatically executes reshuffling (swaps) for optimization, without staff confirmation — nice-to-have, out of MVP.

### Guardrails

- The existing reservation flow, dashboard, driver views, and calendar for regular parking spots keep working unchanged.
- The 10h buffer between one vehicle's departure and the next vehicle's arrival is always respected on auto-assignment.

## User Stories

### US-01: Auto-assign a garage with a 10h buffer when creating a reservation

- **Given** staff creates a reservation that needs a garage/carport
- **When** the reservation is saved
- **Then** the system auto-assigns an available garage/carport so that a minimum 10h buffer is kept between the previous departure and the new arrival; the assigned garage and spot are visible on the reservation, dashboard, driver, calendar views and in the details view
- **Before** the system did not distinguish garages/carports — there was no garage-spot assignment

## Scope of Change

- [new] FR-001: Staff can create/edit garage/carport spots (type garage/carport, single/double, price list, available checkbox). Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- [new] FR-002: The system auto-assigns an available garage/carport to a reservation, respecting a minimum 10h buffer. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- [new] FR-003: Staff sees garage occupancy in a time × garage-spot view. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- [new] FR-004: Staff can manually swap a reservation's garage assignment. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- [new] FR-005: Staff clicks "suggest optimization" and sees a descriptive swap proposal (no auto-execution). Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- [new] FR-006: Garage icon and assigned spot are visible on the reservation, dashboard, driver, and calendar views. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- [new] FR-007: The details view shows the garage description and assigned spot. Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- [preserved] FR-008: Existing reservation, dashboard, driver, and calendar flows for regular parking spots keep working unchanged. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

## Constraints & Compatibility

- Existing reservation, dashboard, calendar, and driver-view flows for regular parking spots must not change.
- Auto-assignment and manual swaps of a garage must never violate the minimum 10h buffer.
- Optimization is descriptive-only in MVP — the system never executes swaps automatically without staff confirmation.

# TODO: backward compatibility requirements (API contracts, data formats, URLs affected by adding a garage/carport spot type) — see Open Questions
# TODO: data migration needs (schema changes for garage/carport spots, backfill/rollback plan) — see Open Questions
# TODO: existing integrations that must keep working through this change — see Open Questions

## Business Logic Changes

For a reservation that needs a garage/carport, the system selects an available garage/carport spot such that a minimum 10h buffer is kept between the previous vehicle's departure and the new arrival; staff can manually override the assignment or request a descriptive optimization proposal.

This is a new domain rule — there is no prior garage/carport allocation logic to state as "current" before it.

Input: the type and availability of configured garage/carport spots, plus the departure/arrival times of reservations. Output: an assigned garage/carport spot (or, on staff request, a descriptive swap proposal that reduces downtime). Staff sees the result on the time × garage-spot view and on every view where a reservation is already shown.

## Access Control Changes

No access control changes — current model preserved. Staff and driver keep their existing roles; no new roles are introduced for this change.

## Non-Goals

- Automatically executing reshuffling (swaps) without staff confirmation — a fully auto-optimizing algorithm is out of MVP (see Success Criteria → Secondary).
- Changing the auth/role model, or changing existing behavior for regular parking spots.
- Supporting multiple airports/locations for garages — scope is limited to a single location.
- Dynamic/seasonal garage pricing — only a static price list per garage/carport type.

## Open Questions

1. **Why now — what's the trigger for adding garage/carport support at this time?** — Owner: user. Block: no.
2. **What is the current workaround for garage/carport allocation, and what does it cost staff today?** — Owner: user. Block: no.
3. **Are there backward-compatibility requirements (API contracts, data formats, URLs) affected by introducing a garage/carport spot type?** — Owner: user. Block: no.
4. **What data migration is needed for existing reservations/spots when garage/carport spots are introduced (schema changes, backfill, rollback plan)?** — Owner: user. By: before implementation planning. Block: yes (affects rollout safety).
5. **Are there existing integrations that must keep working unchanged through this change?** — Owner: user. Block: no.
