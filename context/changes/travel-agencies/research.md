---
date: 2026-09-28T12:00:00+02:00
researcher: Claude (Opus 5.5) for kamfur
git_commit: 1f2a2d3c06a703a54ac3856c327bdebf68da15df
branch: feat/driver-module
repository: parktrack
topic: "Travel agencies — agency reservations, discounted pricing, monthly multi-line VAT invoice"
tags: [research, codebase, invoices, reservations, pricing, price-lists, driver, settings, rls]
status: complete
last_updated: 2026-09-28
last_updated_by: Claude (Opus 5.5)
---

# Research: Travel agencies — agency reservations, discounted pricing, monthly multi-line VAT invoice

**Date**: 2026-09-28 (Europe/Warsaw)
**Researcher**: Claude (Opus 5.5) for kamfur
**Git Commit**: 1f2a2d3 (working tree has large uncommitted changes, including the price-lists feature. Findings describe the files as they are on disk.)
**Branch**: feat/driver-module
**Repository**: parktrack

## Research Question

What in the current codebase must change, and what patterns can be reused, to implement the decisions in `context/changes/travel-agencies/change.md`? The decisions:

- a travel-agency CRUD in Settings;
- an optional agency on reservations, which makes the reservation paid and priced as price list minus a snapshotted discount;
- a staff-only agency module (reservations by arrival month, amount to invoice, invoice history);
- a monthly VAT invoice per agency with one line per completed reservation (net/VAT 23%/gross);
- billing fields locked after invoicing, and issuing blocked while arrivals are unresolved.

## Summary

The feature is new territory. No PRD, roadmap item or change mentions agencies, B2B, discounts or commission. It touches four subsystems, and each has a trap that would silently break the agreed rules:

1. **Invoices are hard-wired 1:1 to a reservation.**
   - `reservation_id NOT NULL` + `UNIQUE`, with `ON DELETE RESTRICT`.
   - There are no VAT columns at all, and the print view renders one hard-coded row.
   - Numbering is `MAX(seq)+1` using *server-local* time, with no lock.
   - Multi-line agency invoices need an `invoice_items` model, an atomic Warsaw-time number allocator, and a rebuilt print view. This is the largest piece.
2. **Pricing lives in the DB, and a trigger will erase a discount.**
   - `trg_update_cost` re-runs `calculate_total_cost` whenever planned dates or parking type change. That includes the driver changing `planned_check_out`.
   - Create and PATCH also accept a client-supplied `total_cost`.
   - The agency discount must be applied *in the DB* (cost function or trigger reading the reservation's discount snapshot), not in the TS service.
3. **The driver flow resets `is_paid`.**
   - `syncIsPaid(paid_at_arrival, paid_at_departure)` overwrites `is_paid` on arrival and departure (`driver.service.ts:29-31,157,182`). Staff check-in reuses the same endpoints.
   - An agency reservation marked paid would flip back to unpaid on arrival.
   - The driver UI has no notion of "paid by agency", so the driver would still see the "Opłacono przy przyjeździe/wyjeździe" checkboxes.
4. **No lock mechanism exists after invoicing.**
   - Edit and cancel rules are status-only (`useReservationDetails.ts:450-490`, `ActionFooter.tsx:93-96`).
   - The only DB-level lock precedent is the driver column-allowlist trigger (`20260909180000_driver_reservation_update_allowlist.sql`), which is the pattern to mirror.

Settings CRUD, navigation, middleware gating and list components all have fresh, directly reusable patterns (the uncommitted price-lists CRUD in particular).

## Detailed Findings

### 1. Invoice subsystem

**Schema.** `supabase/migrations/20260901120000_add_invoices_and_seller_settings.sql`:

- `reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT` (:4) with `unique_invoice_per_reservation UNIQUE (reservation_id)` (:5).
- `invoice_number text UNIQUE` (:6) and `invoice_year/month/seq int` (:7-9). There is no `UNIQUE (year, month, seq)`.
- Seller snapshot: `seller_name/address/nip/bank_account` (:10-13). Buyer: `buyer_name/nip/address NOT NULL`, `buyer_email` nullable (:14-17).
- Amounts: `total_amount numeric(10,2)`, `days_count`, `daily_rate_snapshot` (:18-20). There are no net/VAT/gross fields, no sale or due date, no payment term and no status.
- RLS: "Staff full access to invoices" (`20260909140000_harden_rls_by_app_role.sql:147-152`).

**Seller settings.** These are rows in `public.settings (key PK, value jsonb, updated_by NOT NULL)`: `initial_schema.sql:101-107`, keys seeded at `add_invoices…sql:33-38`.

- New keys need `get_system_user()` for `updated_by` (see `context/archive/2026-09-01-invoice-generation/plan.md:21`).
- There is no `vat_rate` key. `daily_rate` was dropped in `20260926120000_add_price_lists.sql:233`.

**Service.** `src/lib/services/invoice.service.ts`:

- `create` (:68):
  - requires `status === "completed"` (:78);
  - does an app-level duplicate check by reservation (:81);
  - copies `total_amount = reservation.total_cost` (:152), which is gross in effect but not labelled;
  - computes `daily_rate_snapshot` as information only (:113).
- **Numbering** (:116-133): `new Date().getFullYear()/getMonth()` is server-local time, not Europe/Warsaw. It then runs `SELECT max(invoice_seq)` followed by `+1` and an insert. This is a race; a collision surfaces as a generic 500.
- Errors: `ReservationNotFoundError` (:7), `ReservationNotCompletedError` (:14), `DuplicateInvoiceError` (:21).

**API.**

- `src/pages/api/invoices.ts`:
  - GET list (:20-60);
  - GET `?reservation_id=` for a single invoice (:62-89);
  - POST (:92-143), mapping errors to 404/422/409/500.
- `src/pages/api/invoices/[id].ts` handles GET by id.
- Schemas are in `src/lib/schemas/invoice.schema.ts:7-27`.
- Gating: `/faktury` page and `/api/invoices` API are staff-only (`src/middleware/auth.ts:13,23`).

**UI.**

- `src/pages/faktury/index.astro` → `InvoicesListContainer`, whose "reservation" action links to `/rezerwacje/${invoice.reservation_id}` (`InvoicesListContainer.tsx:43`).
- `src/pages/faktury/nowy.astro?reservationId=` requires completed status and redirects if an invoice exists (:21-33). `InvoiceForm` POSTs, then opens the print view.
- `src/pages/faktury/[id]/druk.astro`:
  - loads the single reservation by `invoice.reservation_id` (:21-25);
  - prints "FAKTURA VAT" (:202) with **one hard-coded row** (:237-262);
  - shows a paid badge taken from `reservation.is_paid` (:264-266);
  - has its back link hard-coded to `/rezerwacje` (:197).
- The entry point is `ActionFooter.tsx:67-82` ("Generuj/Pokaż fakturę" for completed reservations), fed by `useReservationDetails.ts:100-137`.

**Consumers of `invoices.reservation_id`.** These all break or need rework if the column becomes nullable or moves to items:

- `invoice.service.ts:35,73,81,139`
- `api/invoices.ts:17-71`
- `faktury/nowy.astro:25-33`
- `druk.astro:24`
- `InvoicesListContainer.tsx:43`
- `useReservationDetails.ts:102`
- `src/types.ts:897-917` (`InvoiceDto.reservation_id: string`)
- `database.types.ts:134-200`
- `supabase/scripts/delete_reservations_before_2026-09-23.sql:7,21,30`

**Tests.** `src/lib/services/invoice.service.test.ts` is mock-only:

- total passthrough (:83);
- completed-only guard (:122-123);
- list (:145-190);
- unique violation (:194).

There is no numbering-race, print or DB-integration test.

### 2. Pricing and the cost trigger

- **Pricing function.** `public.calculate_total_cost(check_in, check_out, parking_type)` is at `20260926120000_add_price_lists.sql:110-150`.
  - Days = `greatest(1, ceil(epoch_diff/86400))`, counted in 24h blocks (:125).
  - The list covering the check-in date in Europe/Warsaw wins, latest `valid_from` first (:126-137). If none covers it, it raises `NO_PRICE_LIST`.
  - For 1–14 days it returns `day_prices[n]` (a total). Beyond that it returns `day_prices[14] + (n-14)*extra_day_price`.
- **Repricing trigger.** `update_reservation_cost()` (:156-170) is BEFORE UPDATE (`trg_update_cost`, `initial_schema.sql:237-240`). It reprices when `planned_check_in`, `planned_check_out` or `parking_type` changes, so any discount stored only in `total_cost` would be overwritten.
- **Client-trusted totals.**
  - `createReservationSchema.total_cost` is optional (`reservation.schema.ts:55`). The service calls the RPC only when it is absent (`reservation.service.ts:180-187`).
  - PATCH accepts `total_cost` (`reservation.schema.ts:93`).
  - The legacy-departure path is the same (`reservation.service.ts:258`).
  - External reservations are always priced server-side as `open_air` (`reservation.service.ts:123`).
- **TS mirror for previews.** `src/lib/pricing/price-list.ts:26-46`.
  - `/api/calculate-cost` (`src/pages/api/calculate-cost.ts:197-299`) returns days and cost-per-day recomputed in JS without the min-1 rule, so they can differ from the DB.
  - `useCostCalculation.ts:13-72` and `CostPreview.tsx:9-60` have no discount concept.
- **`surcharge_amount`** is a driver-entered overstay charge (`20260908140000_add_driver_operation_fields.sql:17`, `driver.service.ts:180`). It is not part of `total_cost` and invoices ignore it. This fits "extensions not charged in v1": for agency reservations it should be hidden or disabled so the driver does not collect it.

### 3. Reservation create/update, forms and statuses

- **Staff create.** `POST /api/reservations` (`reservations.ts:194-216`) → `createReservation` inserts via the admin client (`reservation.service.ts:202-220`). Covered parking types get a garage auto-assigned, with a rollback (:226-243).
  - `is_paid` and `paid_at_*` are **not** in the create schema, so zod strips them.
  - `source` is hard-coded to `"phone"` in both modal modes (`NewReservationModal.tsx:33,56`).
- **Staff PATCH.** `updateReservationSchema` (`reservation.schema.ts:84-110`) allows planned dates, `total_cost`, status, `actual_*`, `paid_at_*`, `is_paid`, `parking_type`, surcharge and more. There is no transition validation for staff.
  - Cancel is a PATCH with `status: "cancelled"` (`useReservationDetails.ts:285-306`).
  - DELETE is a hard delete (`reservation.service.ts:435`), blocked for invoiced rows by the RESTRICT FK.
- **`no_show` is never set.** It exists in the enum (`initial_schema.sql:16`) but is excluded from the update schema, and no UI, API or cron writes it. Only filters display it (`StatusFilter.tsx:38`).
  - Consequence for the "issue invoice is blocked until arrivals are resolved" rule: staff have **no way** to mark a no-show today. Either add a "Nie przyjechał" (no-show) action, or accept "cancelled" as the only resolution.
- **Form types.** They are derived from zod, following lessons.md:
  - `FullReservationFormData` / `EditReservationFormData` (`reservation.schema.ts:173-231,238-276`), re-exported from `src/types.ts:2-7`.
  - `CreateReservationCommand` is a `Pick<TablesInsert>` list (`types.ts:156-174`), so a new column must be added there explicitly.
- **Where the agency select goes.**
  - Next to parking type in `FullReservationForm.tsx:264-283`.
  - Mapping in `NewReservationModal.tsx:41-61`.
  - Pass it to `CostPreview` (:343).
  - In the edit form (`EditReservationForm.tsx`), parking type is display-only (:313). The PATCH payload is built in `ReservationDetailsView.tsx:85-101`.

### 4. Driver side: payment and RLS

- `syncIsPaid` (`src/lib/services/driver.service.ts:29-31`) is used by `confirmArrival` (:157) and `completeDeparture` (:182). **It would reset agency `is_paid=true` to false.** Fix: keep `is_paid` true when `travel_agency_id` is set, and skip or disable the paid checkboxes.
- The driver list select (`driver.service.ts:23-24`) has `is_paid` but no agency, source or total.
  - The row badges (`DriverReservationRow.tsx:58-99`) and the dialog checkboxes (`DriverArrivalDialog.tsx:187-193`, `DriverDepartureDialog.tsx:138-144`) need an "Biuro podróży – opłacone" (agency – paid) state.
  - The helper would live in `src/lib/driver/display.ts`.
- Driver RLS SELECT on reservations is `is_driver_role() and status in (confirmed, in_progress)` (`20260909180000…sql:72-79`).
  - Showing the agency *name* to drivers needs either a driver SELECT policy on `travel_agencies` or a denormalized flag or name.
  - Recommendation: the driver only needs "paid by agency", so derive it from `travel_agency_id IS NOT NULL` and avoid the join.
- **Allowlist trigger.** `enforce_driver_reservation_update` (`20260909180000…sql:22-70`):
  - freezes `total_cost` (:47-48);
  - blocks changes to names, `license_plate` (:39), `planned_check_in` (:40) and `source`;
  - still allows `planned_check_out`, which triggers repricing through `trg_update_cost`.
- Trigger order is alphabetical (`trg_enforce_…` < `trg_update_cost`). A new lock trigger must be named with the ordering in mind.
- **Out-of-scope latent bug found.** Commit 62b902d ("allow entering license plate when confirming arrival") makes `confirmArrival` send `license_plate` (`driver.service.ts:155`). The DB trigger rejects any driver change to `license_plate` (:39) with error 42501, and no migration relaxes it. Unless something else relaxes it, a driver entering a *new* plate gets an error.

### 5. Locks after invoicing

- No lock exists today. Edit and cancel are gated only by status (`useReservationDetails.ts:450-490`, `ActionFooter.tsx:93-96`).
- Pattern to mirror: a BEFORE UPDATE trigger raising `42501` when locked columns change (as in `enforce_driver_reservation_update`), plus UI edit rules.
- For agency invoices the locked columns are:
  - `travel_agency_id`
  - `planned_check_in` / `planned_check_out`
  - `parking_type`
  - `total_cost` / discount snapshot
  - a status change to `cancelled`

  They are locked when an `invoice_items` row references the reservation.
- Because `trg_update_cost` reprices on planned-date changes, the lock trigger must reject *before* the reprice takes effect. Any rejection aborts the statement, so ordering matters only for which error is reported.

### 6. Settings CRUD, navigation, middleware and routes (reusable patterns)

- **`src/pages/ustawienia.astro:1-52`** stacks islands:
  - `SettingsForm` (:37-44), with initial props read through the admin client (:8-31);
  - `PriceListsManager` (:45-47);
  - `GarageSpotConfigurator` in `#miejsca-garazowe` (:48-50).
  - Add a `TravelAgenciesManager` block with an `id` anchor.
- **Price-lists CRUD, the template to copy** (uncommitted):
  - API: `src/pages/api/price-lists.ts` (GET/POST) and `price-lists/[id].ts` (PUT/DELETE, uuid-validated). Each has a local `json()`, a 401 check, JSON parse → 400, `safeParse` → 400 with `flatten()`, and mapped domain errors.
  - Service: `src/lib/services/price-list.service.ts`, with a `toDto` mapper, `23505`→Duplicate, and delete via `.select("id")` where an empty result means not found.
  - Schema: `src/lib/schemas/price-list.schema.ts`, zod with Polish messages; types re-exported via `src/types.ts`.
  - Hook: `src/hooks/usePriceLists.ts` (state, refetch, save/delete with sonner toasts).
  - UI: `PriceListsManager.tsx` / `PriceListDialog.tsx` (a union-state create/edit dialog using local state + zod) / `PriceListTable.tsx`.
  - Tests: `src/pages/api/price-lists.test.ts` (`makeCtx()` with a mocked supabase chain) and `price-list.schema.test.ts`.
- **NIP.** No checksum exists anywhere: `settings.schema.ts:10` and `invoice.schema.ts:24` only check `min(1)`.
  - PRD v1 explicitly declared NIP validation a non-goal (`context/foundation/prd.md:177`, `test-plan.md:189`). The new decision reverses that for agencies only.
  - The validator is new code, e.g. `src/lib/validation/nip.ts`, reused by the agency schema.
- **Archive precedents.**
  - `is_active boolean default true` (`initial_schema.sql:115,132`)
  - `garage_spots.is_available` (`20260921120000_add_garage_spots.sql:11`)
  - `garage_assignments.superseded_at` (history-style)
  - For agencies use `archived_at timestamptz null` (or `is_active`), with delete allowed only when no reservation references the agency (FK `ON DELETE RESTRICT` + mapping `23503` → 409).
- **Navigation.** `src/components/Navigation.tsx:18-26` `navItems` holds `{href,label,icon,staffOnly}`; `getNavItems` (:29-31) filters out `staffOnly` items for drivers.
- **Middleware.** `src/middleware/auth.ts`:
  - `STAFF_ONLY_PAGE_PREFIXES` (:11-18): exact match or `prefix/`. Add `/biura-podrozy`.
  - `STAFF_ONLY_API_PREFIXES` (:21-35): `startsWith`. Add `/api/travel-agencies`.
  - Tests go in `auth.test.ts:96-107`, following the price-lists precedent at :100-101.
- **Routes.** Staff pages use Polish slugs (`/ustawienia`, `/faktury`, `/rezerwacje/[id]`) and APIs use English kebab-case.
  - The detail-page pattern is `rezerwacje/[id].astro` (UUID regex → redirect, `?edit=1` from `Astro.url.searchParams`), so `/biura-podrozy/[id]?month=YYYY-MM` fits it.
  - Layout: `src/layouts/Layout.astro`.
- **Lists.** `ReservationTable` / `ReservationCards` are prop-driven and reusable (`ReservationTable.tsx:24-39`).
  - The list API filters (`reservations.ts:61-136`) have no agency filter, and `date_to` filters on **check-out** (`planned_check_out <=`).
  - The agency view needs its own service query: `travel_agency_id = X AND planned_check_in ∈ [monthStart, nextMonthStart)` in Warsaw time.
  - `url-params.ts` / `useReservationsList.ts` are coupled to `window.location` and the main list, so a dedicated hook is simpler.
- **Migrations.** Naming is `YYYYMMDDHHMMSS_snake.sql`; the latest is `20260926120000_add_price_lists.sql`. Headers use `-- Migration:` / `-- Intent:` plus `comment on`.
  - RLS helpers: `is_staff_role()` / `is_driver_role()` (`20260909140000…sql:11-41`).
  - Regenerate types with `npx supabase gen types typescript --local > src/db/database.types.ts` (no npm script).

## Code References

- `supabase/migrations/20260901120000_add_invoices_and_seller_settings.sql:3-38`: invoices table (1:1 unique, RESTRICT) and seller keys
- `supabase/migrations/20260926120000_add_price_lists.sql:110-170`: `calculate_total_cost` and `update_reservation_cost` (reprice trigger)
- `supabase/migrations/20260909180000_driver_reservation_update_allowlist.sql:22-79`: driver allowlist trigger (lock pattern) and driver SELECT policy
- `supabase/migrations/20260909140000_harden_rls_by_app_role.sql:11-41,147-159`: role helpers and invoice/settings RLS
- `src/lib/services/invoice.service.ts:68-160`: create flow, server-local numbering and race
- `src/pages/faktury/[id]/druk.astro:21-266`: single-row print, no VAT, paid badge from the reservation
- `src/lib/services/reservation.service.ts:46-62,123,180-243,258`: calculateCost RPC, client-trusted total, garage auto-assign
- `src/lib/schemas/reservation.schema.ts:55,84-110,173-276`: create/update schemas and form ViewModels
- `src/lib/services/driver.service.ts:23-31,155-182`: driver select and `syncIsPaid` reset
- `src/components/reservations/FullReservationForm.tsx:264-283`, `NewReservationModal.tsx:33,41-61`: where the agency select and mapping go
- `src/hooks/useReservationDetails.ts:100-137,450-490`, `src/components/reservations/details/ActionFooter.tsx:67-96`: invoice fetch/button and edit rules
- `src/pages/api/price-lists.ts`, `src/lib/services/price-list.service.ts`, `src/hooks/usePriceLists.ts`, `src/components/settings/PriceList*.tsx`: CRUD template
- `src/middleware/auth.ts:11-35`, `src/components/Navigation.tsx:18-31`: gating and menu
- `src/pages/ustawienia.astro:37-50`: settings sections

## Architecture Insights

- **Money rules live in Postgres.** Pricing is a DB function plus a trigger, the driver column rules are a trigger, and RLS is by app role. Agency discount and invoice locks should follow the same approach (DB-enforced, UI mirrors them). Otherwise the driver path, staff PATCH and the external API each become bypasses.
- **Snapshots over live lookups.** Invoices snapshot seller data, and reservations store `total_cost`. The agency discount snapshot on the reservation and buyer snapshot on the invoice follow the same approach.
- **Thin handlers, class services with a constructor-injected supabase client, zod at the boundary, error classes mapped to HTTP codes.** The price-lists change is the freshest and cleanest instance.
- **Europe/Warsaw is the business timezone** (price-list selection, driver lists, stats). The invoice module is the outlier that uses server-local time, and the new billing-month logic must not copy it.

## Historical Context (from prior changes)

- `context/archive/2026-09-01-invoice-generation/plan.md`:
  - VAT breakdown explicitly excluded (:28);
  - 1:1 schema (:69-83);
  - `FV/YYYY/MM/NNN` numbering, with the concurrency fix deferred (:34,43);
  - completed-only guard (:238,260);
  - `total_cost` authoritative (:20,327);
  - "FAKTURA VAT" header with no VAT noted (:324).
- `context/foundation/prd.md:73,123-124,177,182`: FR-010 manual buyer data; NIP format validation declared a non-goal.
- `context/foundation/roadmap.md:9-42,170-180`: only M-1 is recorded, and it is stale (price-lists, garages and driver ops are missing). Parked items: invoice list/archive, NIP validation (GUS/VIES), numbering concurrency. Agencies need a new milestone or slice.
- `context/foundation/test-plan.md:48-54,130-151`:
  - risk #1: invoice total ≠ `total_cost`;
  - risk #2: non-completed reservation invoiced;
  - risk #4: numbering race;
  - risk #5: auth on `/faktury`, `/api/invoices`;
  - risk #6: Warsaw month boundary;
  - risk #7: external API contract.
  - Conventions: Vitest colocated, mocked supabase via constructor, hard-coded money literals (oracle problem), fake timers for timezone tests (`src/pages/api/stats.test.ts`).
- `context/changes/price-lists/change.md`: pricing moved into the DB. Known gaps: a garage swap keeps the price, and the edit form cannot change parking type. The migration may not yet be applied locally.
- `e2e/seed.spec.ts:1-40`, `e2e/E2E-RULES.md`: UI-driven setup, `Date.now()` suffixes, restore or cleanup in the test. Agency e2e cleanup must archive the agency, because deletion is blocked once reservations exist.

## Related Research

- `context/archive/2026-09-01-invoice-generation/` (plan, plan-brief): original invoice design
- `context/changes/price-lists/change.md`: DB pricing decisions
- `context/changes/driver-operations/`: driver payment flags and allowlist trigger origin

## Open Questions

1. **No-show resolution.** Issuing is blocked while arrivals are unresolved, but nothing can set `no_show`. Add a staff "Nie przyjechał" action (status `no_show`), or treat `cancelled` as the only resolution? (Recommended: add the action; the enum value already exists.)
2. **Discount in the DB.** Options:
   - (a) the reservation stores `agency_discount_pct` and `update_reservation_cost` / create apply `base × (1 − pct/100)`;
   - (b) store `base_cost` and `total_cost` separately.

   Rounding: to 0.01 per reservation, half-up. Plan should pick one; (a) is minimal.
3. **Invoice data model.** Options:
   - (a) generalize `invoices` (nullable `reservation_id` → backfill into `invoice_items`, add `travel_agency_id`, totals, `vat_rate`, `sale_date`/period, `payment_due_date`);
   - (b) keep individual invoices untouched and add a parallel `agency_invoices` + `agency_invoice_items` sharing only the number allocator.

   (b) avoids retro-editing issued documents and reduces blast radius; (a) gives one list and one print view. Decision needed in the plan.
4. **VAT on existing individual invoices.** Change.md says fix them in a separate phase. Must already-issued invoices re-render with a net/VAT split (they are documents already sent), or only invoices created after the change? (Recommended: only new ones; old ones keep rendering as they were.)
5. **Numbering allocator.** A shared series needs an atomic DB allocator (counter table or advisory lock in an RPC) keyed by Warsaw year and month, plus `UNIQUE (invoice_year, invoice_month, invoice_seq)`. Should it ship in phase 1, given that agency invoices increase the collision risk?
6. **Changing an agency after creation.** Assigning or unassigning an agency on an un-invoiced reservation must recompute price and `is_paid`. What happens to `paid_at_*` flags collected before the agency was set?
7. **Invoice dates.** Sale date = last day of the billing month? Issue date = creation date? Due date = issue + agency payment term? Needed on the print view for a valid VAT invoice.
8. **`completed` vs `actual_check_in`.** The new rule invoices any reservation with a confirmed arrival, including `in_progress` ones (still parked at issue time). This differs from the individual invoice's completed-only guard (test-plan risk #2). The plan must scope that guard per invoice type.
9. **Out-of-scope bug.** Driver license-plate entry (commit 62b902d) conflicts with the allowlist trigger (`20260909180000…sql:39`). Track it separately.
