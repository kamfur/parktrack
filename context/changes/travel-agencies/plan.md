# Travel Agencies Implementation Plan

## Overview

The parking works with travel agencies that pay for their clients' stays. Staff manage agencies in Settings and assign reservations to an agency. An agency reservation is paid immediately and priced as the standard price list minus the agency discount (snapshotted). A staff-only module `/biura-podrozy` shows each agency's reservations for a billing month (by planned check-in), the amount to invoice, and invoice history. After the month ends, staff issue one VAT invoice per agency with one line per arrived reservation. Invoiced reservations get their billing fields locked.

Underneath, invoices move from "1 invoice = 1 reservation, gross only" to "invoice + items with net/VAT/gross". The shared number series gets an atomic Europe/Warsaw allocator. DB-level money rules get pgTAP tests in CI.

## Current State Analysis

(Full detail: `context/changes/travel-agencies/research.md`.)

- **Invoices.**
  - `invoices.reservation_id NOT NULL UNIQUE`, `ON DELETE RESTRICT`, with no VAT/net/dates (`supabase/migrations/20260901120000_add_invoices_and_seller_settings.sql:3-22`).
  - The print view has one hard-coded row (`src/pages/faktury/[id]/druk.astro:237-262`).
  - Numbering is `MAX(seq)+1` in server-local time with no lock (`src/lib/services/invoice.service.ts:116-133`).
- **Pricing.**
  - `calculate_total_cost()` and `update_reservation_cost()` are BEFORE UPDATE only and reprice on planned dates or parking type changes (`supabase/migrations/20260926120000_add_price_lists.sql:110-170`).
  - Create uses a client `total_cost` when one is given (`src/lib/services/reservation.service.ts:180-187`).
- **Driver.** `syncIsPaid` overwrites `is_paid` from `paid_at_*` (`src/lib/services/driver.service.ts:29-31,157,182`). The allowlist trigger freezes some columns for drivers (`supabase/migrations/20260909180000_driver_reservation_update_allowlist.sql:22-70`).
- **Statuses.** `no_show` exists in the enum but nothing can set it (the update schema excludes it).
- **Agencies.** Nothing exists: no table, no NIP checksum, no discount concept.
- **Tests.** There are no DB tests. CI (`.github/workflows/ci.yml`) runs only `npm run test`, `lint` and `build`.

## Desired End State

1. Staff add, edit and archive travel agencies in `/ustawienia`.
   - Required: name, NIP (checksum-validated) and address.
   - Optional: email, phone, contact person, notes.
   - Also: discount % (0–100) and payment term in days.
   - An agency with reservations cannot be deleted, only archived.
2. The reservation create and edit forms have an optional "Biuro podróży" select (active agencies only).
   - With an agency set, the DB forces `is_paid = true`, clears `paid_at_*` and `surcharge_amount`, and prices the stay as `round(price_list_total × (1 − discount/100), 2)`.
   - The discount is snapshotted from the agency when assigned, and the price survives any date or type edit through any path.
   - `CostPreview` shows the base price, the discount and the final price.
3. Drivers see "Biuro podróży – opłacone" on agency reservations. There are no payment checkboxes and no surcharge input for them.
4. Staff can mark a confirmed reservation "Nie przyjechał" (`no_show`).
5. `/biura-podrozy` lists agencies. `/biura-podrozy/[id]?month=YYYY-MM` shows:
   - reservations with planned check-in in that Warsaw month, with arrival state per row;
   - amount to invoice (net/VAT/gross);
   - reservations blocking the invoice;
   - invoice history.
6. The "Wystaw fakturę za MM/RRRR" button works only after the month has ended. It fails while blocking reservations exist and creates at most one invoice per agency and month.
   - The invoice has one line per arrived reservation: name, plate, dates, days, net, VAT 23%, gross.
   - Dates: issue date = today (Warsaw), sale date = last day of the billing month, due date = issue date + agency term.
   - It uses the shared `FV/YYYY/MM/NNN` series, keyed to the issue month.
7. Invoiced reservations reject changes to agency, planned dates, parking type and price, and reject cancellation, at DB level and in the UI.
8. Individual invoices keep working. Invoices issued before this change print exactly as before. New individual invoices print net/VAT/gross.
9. `npx supabase test db` runs in CI and covers pricing, `is_paid`, locks, uniqueness and numbering.

### Key Discoveries:

- The cost trigger reprices on date or type changes (`20260926120000_add_price_lists.sql:156-170`). A discount stored only in `total_cost` would be lost, so the discount must be applied inside the trigger.
- The driver allowlist trigger freezes `total_cost` but still lets drivers change `planned_check_out` (`20260909180000…sql:39-48`), so repricing reaches the driver path too.
- `syncIsPaid` would flip agency reservations to unpaid on arrival or departure (`driver.service.ts:157,182`). Staff check-in reuses the driver endpoints (`useReservationDetails.ts:236-282`).
- Nine consumers read `invoices.reservation_id`: `invoice.service.ts:35,73,81,139`, `api/invoices.ts:17-71`, `faktury/nowy.astro:25-33`, `druk.astro:24`, `InvoicesListContainer.tsx:43`, `useReservationDetails.ts:102`, `types.ts:897-917`, `supabase/scripts/delete_reservations_before_2026-09-23.sql`.
- The CRUD template to mirror is price-lists: `src/pages/api/price-lists.ts`, `price-lists/[id].ts`, `price-list.service.ts`, `price-list.schema.ts`, `usePriceLists.ts`, `components/settings/PriceList*.tsx`, `src/pages/api/price-lists.test.ts`.
- Warsaw date helpers already exist: `warsawDateKey`, `warsawMonthStart`, `addUtcMonths`, `warsawDayBounds` in `src/lib/calendar/warsaw-time.ts`.
- `settings.updated_by` is NOT NULL, so new keys are seeded with `get_system_user()` (`initial_schema.sql:315`).
- Gating lists live in `src/middleware/auth.ts:11-35`, with tests at `auth.test.ts:96-107`. The menu is `src/components/Navigation.tsx:18-31`.

## What We're NOT Doing

- Charging stay extensions or overstays for agency reservations. Early returns are not refunded.
- Correction invoices, voiding or deleting invoices, and tracking whether an invoice was paid.
- Per-agency API keys. `/api/reservations/external` stays unchanged, and external reservations have no agency.
- Agency logins or portal, email sending, PDF generation (browser print only), and statistics or trends.
- Re-rendering pre-change invoices with VAT (they keep the legacy layout).
- GUS/VIES NIP lookups (checksum only).
- Fixing the driver `license_plate` trigger conflict (tracked as a separate task). Phase 4 must merge with it if that task lands first (see Critical Implementation Details).

## Implementation Approach

Money rules live in Postgres, like the existing pricing and driver rules, and the TS/UI layers mirror them for UX:

- a pricing/payment trigger on reservations;
- an invoice-lock trigger;
- `create_invoice` / `create_agency_invoice` RPCs holding an advisory-lock number allocator;
- an `agency_month_summary` RPC as the single source for both the preview and the issued invoice.

Delivery goes from the riskiest shared foundation to the business feature:

1. DB test harness.
2. Invoice model and allocator. Individual invoices work end to end on the new model.
3. Agency CRUD.
4. Agency reservations.
5. Agency module and monthly invoice.

Each phase is deployable on its own.

VAT math, per line, from the gross price (price lists are gross):

- `net = round(gross / (1 + rate/100), 2)`
- `vat = gross − net`
- invoice totals = sums of the lines

The VAT rate comes from a new `settings.vat_rate` key (default 23) and is snapshotted on each invoice. An invoice with `vat_rate IS NULL` is a legacy invoice.

## Critical Implementation Details

**Trigger ordering on `reservations`.** Postgres fires same-event BEFORE triggers alphabetically:

- `trg_block_invoiced_reservation_update` (new, Phase 5) — lock check;
- `trg_enforce_driver_reservation_update` — driver allowlist;
- `trg_update_cost` — pricing, payment and agency snapshot, extended in Phase 4.

The pricing trigger must stay last so that it computes the final `total_cost` and `is_paid`, overriding anything the client or driver sent.

**Discount snapshot source.** The pricing trigger reads `discount_pct` from `travel_agencies` itself when `travel_agency_id` changes (on INSERT, or UPDATE when distinct). It never trusts a client-sent `agency_discount_pct`. It must be `security definer` so that driver-initiated updates, whose RLS cannot see `travel_agencies`, still work. Archived agencies cannot be newly assigned: the trigger raises, and existing assignments stay valid.

**Coordination with the license-plate task.** Phase 4 redefines `enforce_driver_reservation_update` to also freeze `travel_agency_id` and `agency_discount_pct`. If the separate license-plate fix has already landed, start from its latest definition. `CREATE OR REPLACE` would otherwise silently revert it.

**Allocator.** `pg_advisory_xact_lock(<const>, year*100+month)` inside the RPC transaction, then `max(seq)+1`, then insert, with `UNIQUE (invoice_year, invoice_month, invoice_seq)` as a backstop. Year and month come from `now() at time zone 'Europe/Warsaw'`.

## Phase 1: DB test harness

### Overview

Add pgTAP tests and a CI job so every later phase ships SQL-level tests for its triggers and RPCs.

### Changes Required:

#### 1. pgTAP test suite

**File**: `supabase/tests/000_smoke.test.sql` (new directory `supabase/tests/`)

**Intent**: Smoke-test the existing money rules to prove the harness works and pin current behavior before we change it.

**Contract**:

- `begin; select plan(n); … select * from finish(); rollback;` per file, using `create extension if not exists pgtap`.
- Cases:
  - `calculate_total_cost` returns `day_prices[n]` for a seeded price list;
  - it raises `NO_PRICE_LIST` outside coverage;
  - `trg_update_cost` reprices on a `planned_check_out` change.
- A helper `supabase/tests/helpers.sql` (or inline setup) seeds a price list and sets JWT claims for staff/driver roles via `set local request.jwt.claims`, as expected by `current_app_role()`.

#### 2. CI job

**File**: `.github/workflows/ci.yml`

**Intent**: Run the DB tests on every PR.

**Contract**: A new job `db-tests` using `supabase/setup-cli@v1`, running `supabase db start` (or `supabase start -x` excluding unneeded services), then `supabase test db`. It is independent of the existing `ci` job.

#### 3. Docs

**File**: `AGENTS.md` (commands section), `context/foundation/test-plan.md` (§6 test types)

**Intent**: Document `npx supabase test db` and the rule "DB triggers/RPCs get pgTAP tests".

### Success Criteria:

#### Automated Verification:

- Local DB rebuilds cleanly: `npx supabase db reset`
- pgTAP suite passes locally: `npx supabase test db`
- Existing unit tests still pass: `npm run test`
- CI `db-tests` job is green on the PR

#### Manual Verification:

- A deliberately broken assertion makes `db-tests` fail in CI (then revert)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Invoice foundation (items, VAT, atomic numbering)

### Overview

Move invoices to an invoice + items model with VAT, dates and an atomic Warsaw-time allocator. Individual invoices keep working end to end. Legacy invoices print unchanged.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20260928120000_invoice_items_and_vat.sql`

**Intent**: Generalize invoices without changing the content of issued documents.

**Contract**:

- **`invoice_items`**:
  - `id uuid pk`
  - `invoice_id uuid not null references invoices on delete cascade`
  - `position int not null`
  - `reservation_id uuid not null references reservations on delete restrict`, `unique (reservation_id)`
  - snapshots: `guest_name text`, `license_plate text null`, `period_start timestamptz`, `period_end timestamptz`, `parking_type text`, `days_count int`, `description text`
  - `net_amount numeric(10,2) null`, `vat_amount numeric(10,2) null`, `gross_amount numeric(10,2) not null`
  - `unique (invoice_id, position)`
  - RLS: staff-only, same as invoices.
- **`invoices` additions**:
  - `travel_agency_id uuid null` (FK added in Phase 3)
  - `billing_year int null`, `billing_month int null`
  - `issue_date date not null default (now() at time zone 'Europe/Warsaw')::date` (backfilled from `created_at` in Warsaw time)
  - `sale_date date null`
  - `payment_due_date date null`
  - `vat_rate numeric(5,2) null`
  - `total_net numeric(10,2) null`, `total_vat numeric(10,2) null`
  - `total_amount` stays and means gross.
- **Backfill**: one item per existing invoice from its reservation (`gross_amount = total_amount`, `days_count` from the invoice, net/VAT null). Then drop `invoices.reservation_id`, `unique_invoice_per_reservation`, `days_count` and `daily_rate_snapshot`.
- **Constraint**: `unique (invoice_year, invoice_month, invoice_seq)`.
- **Setting**: seed the key `vat_rate` = `23` using `get_system_user()`.
- **Function** `next_invoice_number()`: internal; takes the advisory lock and returns `(year, month, seq, number)` in Warsaw time.
- **RPC** `create_invoice(p_reservation_id uuid, p_buyer_name text, p_buyer_nip text, p_buyer_address text, p_buyer_email text) returns uuid`:
  - `security invoker`;
  - requires status `completed` (raises `RESERVATION_NOT_COMPLETED`) and no existing item (raises `DUPLICATE_INVOICE`);
  - snapshots the seller from settings and the rate from `vat_rate`;
  - computes the line and totals with the VAT math;
  - `created_by = auth.uid()`;
  - `sale_date = coalesce(actual_check_out, planned_check_out)` in Warsaw time.

#### 2. Types

**File**: `src/db/database.types.ts`, `src/types.ts`

**Intent**: Regenerate DB types (`npx supabase gen types typescript --local > src/db/database.types.ts`) and reshape the DTOs.

**Contract**:

- `InvoiceDto` drops `reservation_id`, `days_count` and `daily_rate_snapshot`, and gains `items: InvoiceItemDto[]`, the date fields, VAT fields and `travel_agency_id`.
- `InvoiceItemDto` mirrors the item row.

#### 3. Service and API

**File**: `src/lib/services/invoice.service.ts`, `src/pages/api/invoices.ts`, `src/pages/api/invoices/[id].ts`

**Intent**: Create through the RPC and read through items.

**Contract**:

- `create()` calls `rpc("create_invoice")` and maps the error codes to the existing error classes (404/422/409).
- `getByReservationId()` goes through `invoice_items` (`select invoice_id … eq reservation_id`).
- `getById()` returns the invoice with its items ordered by position.
- `list()` stays the same. The API response shapes change only by the DTO fields.

#### 4. UI consumers

**File**: `src/pages/faktury/nowy.astro`, `src/components/invoices/InvoicesListContainer.tsx`, `src/hooks/useReservationDetails.ts`

**Intent**: Replace `invoice.reservation_id` reads.

**Contract**:

- The existing-invoice redirect in `nowy.astro` looks up through items.
- The list's "reservation" action appears only when the invoice has exactly one item, and links to `items[0].reservation_id`. The list API returns `items(reservation_id)`.
- `useReservationDetails` uses the reworked `?reservation_id=` endpoint without contract change.

#### 5. Print view

**File**: `src/pages/faktury/[id]/druk.astro`

**Intent**: Render N item rows. Legacy invoices (`vat_rate IS NULL`) keep today's layout. VAT invoices show Lp, description (guest, plate, period, days), net, VAT %, VAT, gross, plus a totals block and issue/sale/due dates.

**Contract**:

- The paid badge stays only for single-item individual invoices, from that reservation's `is_paid`.
- Agency invoices (`travel_agency_id` set) show the billing period ("Okres rozliczeniowy: wrzesień 2026"), the due date and the bank account.
- The back link goes to `/faktury`.

#### 6. Settings: VAT rate

**File**: `src/lib/schemas/settings.schema.ts`, `src/components/settings/SettingsForm.tsx`, `src/pages/ustawienia.astro`

**Intent**: Let staff edit `vat_rate` (0–100, 2 decimals) under "Dane sprzedawcy".

#### 7. Cleanup script

**File**: `supabase/scripts/delete_reservations_before_2026-09-23.sql`

**Intent**: Point it at `invoice_items` instead of `invoices.reservation_id`, or mark it obsolete in a header comment if it has already been run.

#### 8. Tests

**Files**:

- `supabase/tests/010_invoices.test.sql`:
  - backfill shape;
  - `create_invoice` VAT math (e.g. gross 123.00 → net 100.00, VAT 23.00; gross 100.00 → net 81.30, VAT 18.70);
  - completed-only;
  - duplicate raises;
  - sequential numbers within a month;
  - `unique (year, month, seq)`;
  - Warsaw boundary (`now()` faked via `set local` of a test clock, or asserted through `next_invoice_number` with an injected timestamp parameter).
- `src/lib/services/invoice.service.test.ts`: RPC call and error mapping, plus `getByReservationId` through items.

### Success Criteria:

#### Automated Verification:

- Migration applies on a DB with existing invoices: `npx supabase db reset` (seed includes at least one invoice)
- pgTAP passes: `npx supabase test db`
- Unit tests pass: `npm run test`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- A pre-change invoice prints identically to before (compare with a screenshot taken before migrating)
- A new individual invoice for a completed reservation prints net/VAT/gross and the dates, and gets the next number in the Warsaw month
- "Pokaż fakturę" on reservation details and the list's "reservation" link still work
- The VAT rate edit in Settings persists

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Travel agencies CRUD

### Overview

Agency master data with archival, a NIP checksum, an API and a Settings section.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20260928130000_add_travel_agencies.sql`

**Intent**: Store agencies. Deletion is blocked by FK once referenced.

**Contract**:

- `travel_agencies`:
  - `id uuid pk`
  - `name text not null`
  - `nip text not null unique` (10 digits, normalized)
  - `address text not null`
  - `email text null`, `phone text null`, `contact_person text null`, `notes text null`
  - `discount_pct numeric(5,2) not null default 0 check (0..100)`
  - `payment_term_days int not null default 14 check (0..365)`
  - `archived_at timestamptz null`
  - `created_at`, `updated_at` + the `handle_updated_at` trigger
- RLS: "Staff manage travel_agencies" `for all using/with check (is_staff_role())`. There is no driver access.
- Add FK `invoices.travel_agency_id → travel_agencies on delete restrict`.

#### 2. NIP validator

**File**: `src/lib/validation/nip.ts` (+ `nip.test.ts`)

**Intent**: Normalize (strip spaces and dashes, optional `PL` prefix) and validate the checksum: weights `6,5,7,2,3,4,5,6,7`, `sum mod 11` equals the 10th digit, and 10 is invalid.

**Contract**: `normalizeNip(input: string): string` and `isValidNip(input: string): boolean`.

#### 3. Schema, service, API

**Files**: `src/lib/schemas/travel-agency.schema.ts` (+ test), `src/lib/services/travel-agency.service.ts`, `src/pages/api/travel-agencies.ts` (GET list with `?include_archived`, POST), `src/pages/api/travel-agencies/[id].ts` (PUT, DELETE, POST `archive` via `PATCH { archived: boolean }`), `src/types.ts`

**Intent**: Mirror the price-lists layering.

**Contract**:

- The zod schema has Polish messages and a `refine(isValidNip)` on the NIP.
- Service errors: `TravelAgencyNotFoundError`, `DuplicateNipError` (23505 → 409), `TravelAgencyInUseError` (23503 on delete → 409 with the message "Biuro ma rezerwacje — możesz je zarchiwizować").
- The DTO and command types are re-exported from `src/types.ts`.

#### 4. Settings UI

**Files**: `src/hooks/useTravelAgencies.ts`, `src/components/settings/TravelAgenciesManager.tsx`, `src/components/settings/TravelAgencyDialog.tsx`, `src/pages/ustawienia.astro`

**Intent**: Add a new section `#biura-podrozy` after the price lists.

**Contract**:

- The list shows name, NIP, discount and an archived badge, with a "Pokaż zarchiwizowane" toggle.
- The dialog handles create and edit.
- Actions: Archiwizuj/Przywróć, and Usuń with `window.confirm`. A 409 shows the archive hint.

#### 5. Gating

**File**: `src/middleware/auth.ts`, `src/middleware/auth.test.ts`

**Intent**: Make `/api/travel-agencies` staff-only (API prefix list) and pre-register the `/biura-podrozy` page prefix, with tests for the base and `/<uuid>` paths.

#### 6. Tests

**Files**:

- `src/pages/api/travel-agencies.test.ts`: 401, 400 on a bad NIP, 201, 409 on a duplicate NIP, 409 on an in-use delete.
- The schema test.
- `nip.test.ts`: valid, invalid checksum, formatting variants.
- `supabase/tests/020_travel_agencies.test.sql`: driver cannot select, staff can, FK blocks delete once referenced (after Phase 4 adds the reservation FK, extend there).

### Success Criteria:

#### Automated Verification:

- Migration applies: `npx supabase db reset`
- pgTAP passes: `npx supabase test db`
- Unit and integration tests pass: `npm run test`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification:

- Create, edit, archive and restore an agency in `/ustawienia`. An invalid NIP shows a Polish error.
- A driver account gets 403 on `/api/travel-agencies`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Agency reservations (pricing, payment, driver, no-show)

### Overview

Assign agencies on reservations. The DB enforces the discounted price and paid status on every path. Drivers see "paid by agency". Staff can mark no-shows.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20260928140000_agency_reservations.sql`

**Intent**: Add the agency columns and make pricing and payment agency-aware on INSERT and UPDATE.

**Contract**:

- `reservations.travel_agency_id uuid null references travel_agencies on delete restrict`, with an index.
- `reservations.agency_discount_pct numeric(5,2) null`.
- Replace `update_reservation_cost()` (`security definer`), attached as BEFORE INSERT OR UPDATE (`trg_update_cost`, recreated for both events):
  - When `travel_agency_id` changes (or on INSERT with an agency): load the agency. Raise `AGENCY_ARCHIVED` if it is archived. Otherwise set `agency_discount_pct := agency.discount_pct`. If the agency is removed: `agency_discount_pct := null`.
  - When the reservation has an agency and (INSERT, or planned dates/type/agency changed): `total_cost := round(calculate_total_cost(...) × (1 − pct/100), 2)`. When it has no agency, keep today's behavior: reprice on UPDATE of dates or type, and trust the provided `total_cost` on INSERT.
  - When the reservation has an agency: `is_paid := true`, `paid_at_arrival := false`, `paid_at_departure := false`, `surcharge_amount := null`. When the agency is removed: `is_paid := paid_at_arrival or paid_at_departure`.
- Redefine `enforce_driver_reservation_update` to also reject driver changes to `travel_agency_id` and `agency_discount_pct`. See Critical Implementation Details on merging with the license-plate fix.
- Extend the driver SELECT exposure: no policy change is needed, because drivers read `travel_agency_id` from their own reservation row.

#### 2. Schemas and types

**File**: `src/lib/schemas/reservation.schema.ts`, `src/types.ts`, `src/db/database.types.ts`

**Intent**: Accept `travel_agency_id` (uuid | null) on create and update. Add `no_show` to the update status enum. Add `travel_agency_id` to `CreateReservationCommand`'s Pick and to the form ViewModels via `z.infer` (lessons.md).

#### 3. Service

**File**: `src/lib/services/reservation.service.ts`, `src/pages/api/calculate-cost.ts`

**Intent**: For an agency reservation, drop any client `total_cost` on create and update (the trigger prices it). Map `AGENCY_ARCHIVED` to 422. Detail and list selects include `travel_agency_id` and `travel_agencies(name)`.

**Contract**:

- `calculateCost()` and `/api/calculate-cost` accept an optional `travel_agency_id`.
- The response adds `base_cost`, `discount_pct` and `total_cost`, reading the discount from the agency. This is a preview only; the DB stays authoritative.
- `/api/reservations` list gets an optional `travel_agency_id` filter.

#### 4. Forms and details

**Files**: `src/components/reservations/FullReservationForm.tsx`, `NewReservationModal.tsx`, `EditReservationForm.tsx`, `details/ReservationDetailsView.tsx`, `details/ActionFooter.tsx`, `CostPreview.tsx`, `src/hooks/useCostCalculation.ts`, `src/hooks/useReservationDetails.ts`

**Intent**:

- A "Biuro podróży" select next to parking type ("— brak —" plus active agencies from `useTravelAgencies`).
- `CostPreview` shows "Cena cennikowa / Rabat X% / Do zapłaty przez biuro".
- The details view shows the agency name and "Opłacone przez biuro".
- The edit form can change the agency.
- ActionFooter adds "Nie przyjechał" for `confirmed` reservations without `actual_check_in` (confirm dialog, PATCH `status: "no_show"`).
- `getEditRules` treats `no_show` like `cancelled` (read-only).

#### 5. Driver

**Files**: `src/lib/services/driver.service.ts`, `src/lib/driver/display.ts` (+ test), `src/components/driver/DriverReservationRow.tsx`, `DriverArrivalDialog.tsx`, `DriverDepartureDialog.tsx`

**Intent**:

- The driver select adds `travel_agency_id`.
- `display.ts` gets `isAgencyPaid(row)`.
- The row shows a badge "Biuro podróży – opłacone".
- The dialogs hide the paid checkboxes and the surcharge input for agency rows.
- `syncIsPaid` callers skip writing `is_paid` / `paid_at_*` for agency rows. This is defense in depth, since the trigger overrides them anyway.

#### 6. Tests

- `supabase/tests/030_agency_pricing.test.sql`:
  - insert with an agency → discounted price, `is_paid`, snapshot;
  - a client `total_cost` is ignored;
  - a staff date edit keeps the discount;
  - a driver `planned_check_out` edit keeps the discount;
  - a driver arrival with `paid_at_*` false keeps `is_paid = true`;
  - removing the agency restores the full price and derives `is_paid`;
  - an agency discount change does not alter existing reservations;
  - assigning an archived agency raises;
  - a driver cannot change `travel_agency_id`.
- Vitest: schema tests (agency field, `no_show`), service tests (client total dropped, 422 mapping), `display.test.ts`, `calculate-cost` test with an agency.

### Success Criteria:

#### Automated Verification:

- Migration applies: `npx supabase db reset`
- pgTAP passes: `npx supabase test db`
- Unit tests pass: `npm run test`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification:

- Creating a reservation with an agency (discount 15%) shows the discounted preview and saves `is_paid = true` with the discounted `total_cost`
- Editing its dates keeps the discount, and removing the agency restores the full price
- In the driver module the row shows "Biuro podróży – opłacone" and arrival/departure dialogs have no payment checkboxes. After arrival the reservation is still paid.
- "Nie przyjechał" sets `no_show`, and the reservation becomes read-only
- Non-agency reservations behave exactly as before (price, driver payment flags)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Agency module, monthly invoice and locks

### Overview

The staff module with the month view and the invoice issue flow, backed by one summary RPC, plus DB locks on invoiced reservations.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20260928150000_agency_invoicing.sql`

**Intent**: Provide a single source of truth for the month summary and issuing, plus locks.

**Contract**:

- **Month window** = `[make_date(y,m,1), +1 month)` interpreted `at time zone 'Europe/Warsaw'` against `planned_check_in`.
- **RPC** `agency_month_summary(p_agency_id uuid, p_year int, p_month int)`:
  - returns rows (reservation id, name, plate, planned dates, status, `actual_check_in`, `total_cost`, category, `invoice_id` when invoiced) plus computed net/VAT/gross of the invoiceable set using the current `vat_rate`;
  - `category` ∈ `invoiceable` (arrived, not cancelled or no-show, not yet invoiced) | `blocking` (no `actual_check_in`, status not in cancelled/no_show) | `excluded` (cancelled/no_show) | `invoiced`;
  - `security invoker`, staff via RLS.
- **RPC** `create_agency_invoice(p_agency_id uuid, p_year int, p_month int) returns uuid`:
  - raises `MONTH_NOT_CLOSED` if Warsaw today < first day of the next month;
  - raises `BLOCKING_RESERVATIONS` if any are blocking (the API re-queries the summary to list them);
  - raises `ALREADY_INVOICED` if an invoice exists for (agency, year, month);
  - raises `NOTHING_TO_INVOICE` if there are zero invoiceable rows;
  - otherwise it:
    - allocates a number via `next_invoice_number()`;
    - snapshots the seller and the buyer (agency name/NIP/address/email);
    - sets `billing_year/month`, `issue_date = Warsaw today`, `sale_date = last day of the billing month`, `payment_due_date = issue_date + payment_term_days` and `vat_rate`;
    - inserts one item per invoiceable reservation (ordered by `planned_check_in`) with the VAT math, and the totals.
- Partial unique index `invoices (travel_agency_id, billing_year, billing_month) where travel_agency_id is not null`.
- **Lock trigger** `trg_block_invoiced_reservation_update` (BEFORE UPDATE on reservations):
  - If an `invoice_items` row references `old.id`: raise `RESERVATION_INVOICED` when any of `travel_agency_id`, `planned_check_in`, `planned_check_out`, `parking_type`, `total_cost` or `agency_discount_pct` changes, or when status changes to `cancelled` / `no_show`.
  - Also raise `AGENCY_MONTH_INVOICED` when `new.travel_agency_id` is set and (agency, Warsaw month of `new.planned_check_in`) already has an invoice, and either the agency or `planned_check_in` changed. This prevents reservations slipping into an already-invoiced month where they would never be billed.
  - It applies to individual invoices too. Their reservations are completed, and changing billing fields after invoicing is equally wrong.

#### 2. Service and API

**Files**: `src/lib/services/agency-billing.service.ts` (+ test), `src/pages/api/travel-agencies/[id]/summary.ts` (GET `?month=YYYY-MM`), `src/pages/api/travel-agencies/[id]/invoices.ts` (GET history, POST `{ month }` issue), `src/lib/schemas/agency-billing.schema.ts`

**Intent**: Keep the handlers thin over the RPCs.

**Contract**:

- `month` is zod-validated as `^\d{4}-(0[1-9]|1[0-2])$`.
- POST maps errors:
  - `MONTH_NOT_CLOSED` → 422;
  - `BLOCKING_RESERVATIONS` → 409 with `{ blocking: [...] }` from the summary;
  - `ALREADY_INVOICED` → 409;
  - `NOTHING_TO_INVOICE` → 422;
  - success → 201 `{ invoiceId }`.
- The reservations PATCH maps `RESERVATION_INVOICED` / `AGENCY_MONTH_INVOICED` to 409 with Polish messages.

#### 3. Pages and components

**Files**:

- `src/pages/biura-podrozy/index.astro`: agency list (active first, archived collapsed) with links.
- `src/pages/biura-podrozy/[id].astro`: UUID guard → redirect, `?month` defaulting to the previous Warsaw month.
- `src/components/agencies/AgencyMonthView.tsx`, `src/hooks/useAgencyMonth.ts`.

**Intent**:

- A month picker (prev/next).
- The reservation table reuses `ReservationTable`/`ReservationCards` presentation where it fits, and adds an "Przyjazd" (arrival) column with states Przyjechał / Oczekuje / Nie przyjechał / Anulowana and a "Na fakturze" badge.
- A summary card with net/VAT/gross of the invoiceable set.
- A blocking alert listing the reservations to resolve, each linking to `/rezerwacje/[id]`.
- A "Wystaw fakturę za MM/RRRR" button (disabled with a reason when the month is not closed, blocked, already invoiced or empty). On success it opens `/faktury/[id]/druk`.
- An invoice-history table (number, period, gross, issue date → print).

#### 4. Navigation, gating, reservation UI locks

**Files**: `src/components/Navigation.tsx`, `src/middleware/auth.ts` (+ test, already pre-registered in Phase 3; verify), `src/hooks/useReservationDetails.ts`, `details/ActionFooter.tsx`, `EditReservationForm.tsx`

**Intent**:

- Add the menu item "Biura podróży" (staff-only).
- When the reservation has an invoice (`existingInvoiceId`), `getEditRules` disables the agency, planned dates, parking type and cancel/no-show controls with the hint "Rezerwacja jest na fakturze {numer}".

#### 5. Tests

- `supabase/tests/040_agency_invoicing.test.sql`:
  - summary categories (arrived / pending / cancelled / no_show / invoiced), Warsaw boundary (check-in 2026-09-30 23:30 Warsaw belongs to September);
  - `MONTH_NOT_CLOSED`, `BLOCKING_RESERVATIONS`, `ALREADY_INVOICED`, `NOTHING_TO_INVOICE`;
  - line and total VAT math;
  - `in_progress` arrived reservations included;
  - the lock trigger rejects date, agency and cancel changes on an invoiced reservation and allows `actual_check_out` / notes / sector;
  - `AGENCY_MONTH_INVOICED` on assignment into an invoiced month;
  - a shared-series number follows the last individual invoice.
- Vitest:
  - `agency-billing.service.test.ts` (error mapping);
  - API tests for `summary` / `invoices` (400 bad month, 401, 409 with the blocking list, 201);
  - the `auth.test.ts` page prefix.
- E2E via `/10x-e2e`: one path — create a uniquely named agency in Settings → create a reservation with that agency → it appears in `/biura-podrozy/[id]` for its month with the discounted price → cleanup: cancel the reservation and archive the agency.
  - Invoice issuing is covered in pgTAP, because it needs a closed past month and a confirmed arrival.

### Success Criteria:

#### Automated Verification:

- Migration applies: `npx supabase db reset`
- pgTAP passes: `npx supabase test db`
- Unit and integration tests pass: `npm run test`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- E2E passes: `npm run test:e2e -- e2e/travel-agencies.spec.ts`

#### Manual Verification:

- For a closed month with one pending arrival, issuing is blocked and the pending reservation is listed. After marking "Nie przyjechał", issuing succeeds.
- The printed agency invoice shows one row per arrived reservation, correct net/VAT/gross totals, the period, the sale/issue/due dates and the next number in the shared series
- A second issue attempt for the same agency and month is rejected
- The invoiced reservation's details show locked billing fields, and editing notes still works
- The current (open) month shows the amount to invoice, but the button is disabled with "Miesiąc jeszcze trwa"
- A driver cannot open `/biura-podrozy` (redirected to `/kierowca`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- NIP normalization and checksum.
- Zod schemas (agency, reservation agency field / `no_show`, month param).
- `display.ts` agency helper.
- Service error mapping (invoice RPC codes, agency CRUD 23505/23503, billing codes).

### Integration Tests:

- **API handlers with a mocked Supabase** (Vitest, `makeCtx()` pattern): travel-agencies CRUD, summary/invoices endpoints, calculate-cost with an agency.
- **pgTAP (real Postgres) for every money rule:**
  - discount pricing across all update paths;
  - `is_paid` enforcement vs the driver flow;
  - archived-agency assignment;
  - invoice VAT math and rounding;
  - allocator sequencing and uniqueness;
  - month summary categories and the Warsaw boundary;
  - issue guards;
  - lock trigger;
  - legacy invoice backfill.
- Money assertions use hard-coded literals (test-plan §6.4, oracle problem).

### Manual Testing Steps:

1. Print a legacy invoice before and after Phase 2 and compare.
2. Create an agency with 15% discount → reservation 7 days open_air → check price = round(list × 0.85, 2) and paid.
3. As a driver, confirm arrival with the payment checkboxes absent → still paid.
4. For a closed month: one arrived, one pending → issuing blocked → mark pending as no-show → issue → print → verify totals by hand.
5. Try to edit the invoiced reservation's dates → a Polish 409 message.

## Performance Considerations

Volumes are small (tens to hundreds of reservations per agency per month). `agency_month_summary` filters on `travel_agency_id` (indexed) plus the `planned_check_in` range. The advisory lock is per month and held only for the insert transaction.

## Migration Notes

- The Phase 2 migration rewrites `invoices` (drops `reservation_id`, `days_count`, `daily_rate_snapshot` after backfilling items).
  - Take a DB backup before deploying to Railway/Supabase prod, and apply the migrations with `supabase db push` (see memory: prod migrations are applied manually).
  - Rollback is restore from backup. The migration is not reversible without data loss, so it is deployed alone and verified with the manual Phase 2 checks before Phase 3.
- Existing invoices become legacy (`vat_rate` null) and print unchanged.
- The Phase 4 trigger change applies to new writes only. Existing reservations have no agency and are unaffected.

## References

- Research: `context/changes/travel-agencies/research.md`
- Decisions: `context/changes/travel-agencies/change.md`
- Original invoice design: `context/archive/2026-09-01-invoice-generation/plan.md`
- CRUD template: `src/pages/api/price-lists.ts`, `src/lib/services/price-list.service.ts`, `src/components/settings/PriceListsManager.tsx`
- Lock pattern: `supabase/migrations/20260909180000_driver_reservation_update_allowlist.sql:22-70`
- Pricing: `supabase/migrations/20260926120000_add_price_lists.sql:110-170`
- Warsaw helpers: `src/lib/calendar/warsaw-time.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: DB test harness

#### Automated

- [ ] 1.1 Local DB rebuilds cleanly: `npx supabase db reset`
- [x] 1.2 pgTAP suite passes locally: `npx supabase test db` — f4bfaf5
- [x] 1.3 Existing unit tests still pass: `npm run test` — f4bfaf5
- [ ] 1.4 CI `db-tests` job is green on the PR

#### Manual

- [ ] 1.5 A deliberately broken assertion makes `db-tests` fail in CI (then revert)

### Phase 2: Invoice foundation (items, VAT, atomic numbering)

#### Automated

- [x] 2.1 Migration applies on a DB with existing invoices: `npx supabase db reset` — 16ad438
- [x] 2.2 pgTAP passes: `npx supabase test db` — 16ad438
- [x] 2.3 Unit tests pass: `npm run test` — 16ad438
- [x] 2.4 Type checking passes: `npm run typecheck` — 16ad438
- [ ] 2.5 Linting passes: `npm run lint`
- [x] 2.6 Build passes: `npm run build` — 16ad438

#### Manual

- [ ] 2.7 A pre-change invoice prints identically to before
- [ ] 2.8 A new individual invoice prints net/VAT/gross and the dates, and gets the next number in the Warsaw month
- [ ] 2.9 "Pokaż fakturę" and the list's "reservation" link still work
- [ ] 2.10 The VAT rate edit in Settings persists

### Phase 3: Travel agencies CRUD

#### Automated

- [x] 3.1 Migration applies: `npx supabase db reset`
- [x] 3.2 pgTAP passes: `npx supabase test db`
- [x] 3.3 Unit and integration tests pass: `npm run test`
- [x] 3.4 Type checking passes: `npm run typecheck`
- [ ] 3.5 Linting passes: `npm run lint`

#### Manual

- [ ] 3.6 Create, edit, archive and restore an agency in `/ustawienia`; an invalid NIP shows a Polish error
- [ ] 3.7 A driver account gets 403 on `/api/travel-agencies`

### Phase 4: Agency reservations (pricing, payment, driver, no-show)

#### Automated

- [ ] 4.1 Migration applies: `npx supabase db reset`
- [ ] 4.2 pgTAP passes: `npx supabase test db`
- [ ] 4.3 Unit tests pass: `npm run test`
- [ ] 4.4 Type checking passes: `npm run typecheck`
- [ ] 4.5 Linting passes: `npm run lint`

#### Manual

- [ ] 4.6 An agency reservation shows the discounted preview and saves paid with the discounted total
- [ ] 4.7 Date edits keep the discount; removing the agency restores the full price
- [ ] 4.8 The driver sees "Biuro podróży – opłacone" and no payment checkboxes; still paid after arrival
- [ ] 4.9 "Nie przyjechał" sets `no_show` and the reservation becomes read-only
- [ ] 4.10 Non-agency reservations behave exactly as before

### Phase 5: Agency module, monthly invoice and locks

#### Automated

- [ ] 5.1 Migration applies: `npx supabase db reset`
- [ ] 5.2 pgTAP passes: `npx supabase test db`
- [ ] 5.3 Unit and integration tests pass: `npm run test`
- [ ] 5.4 Type checking passes: `npm run typecheck`
- [ ] 5.5 Linting passes: `npm run lint`
- [ ] 5.6 Build passes: `npm run build`
- [ ] 5.7 E2E passes: `npm run test:e2e -- e2e/travel-agencies.spec.ts`

#### Manual

- [ ] 5.8 Issuing is blocked with a pending arrival listed; succeeds after "Nie przyjechał"
- [ ] 5.9 The printed agency invoice has correct rows, totals, period, dates and shared-series number
- [ ] 5.10 A second issue for the same agency and month is rejected
- [ ] 5.11 The invoiced reservation shows locked billing fields; notes remain editable
- [ ] 5.12 The open month shows the amount but the button is disabled ("Miesiąc jeszcze trwa")
- [ ] 5.13 A driver cannot open `/biura-podrozy`
