# Invoice Generation Implementation Plan

## Overview

Add invoice generation directly from a completed reservation's detail view. Staff enters buyer company data on a dedicated form page, which creates a persisted invoice record with a sequential number (FV/{rok}/{miesiąc}/{numer}) and redirects to a browser-printable view. Seller data (parking company name, address, NIP, bank account) is configured once in /ustawienia.

## Current State Analysis

- `reservations` table has `total_cost` (computed via tiered `pricing_rules` RPC against planned dates), `actual_check_in` and `actual_check_out` (set during check-in/out operations), `is_paid` (boolean)
- `settings` table stores key-value JSONB pairs; `daily_rate` was added in S-01
- `ReservationDetailsView` renders `ActionFooter` (check-in / check-out / edit / cancel buttons gated by status)
- No `invoices` table, no invoice API, no invoice UI

## Desired End State

Staff opens a completed reservation, sees "Generuj fakturę" in ActionFooter. Clicking navigates to `/faktury/nowy?reservationId=...` where they enter buyer name, NIP, address (optionally email) and submit. Invoice is saved with a sequential number; the browser redirects to `/faktury/[id]/druk` — a print-ready Astro SSR page. Re-opening the same reservation shows "Pokaż fakturę" linking back to the print view.

### Key Discoveries

- `reservations.total_cost` is computed by `calculate_total_cost()` RPC using tiered `pricing_rules` (30/25/20 PLN) against **planned** dates — NOT `daily_rate × days`. Invoice shows stored `total_cost` as the authoritative billed amount; `days_count` (24h periods from actual timestamps) and `daily_rate_snapshot` are informational line items. This inconsistency is accepted for MVP.
- `settings` table requires `updated_by uuid NOT NULL` (FK to `auth.users`). New seller settings rows in the migration must use the existing `get_system_user()` Postgres function (established pattern from `20251017120000_initial_schema.sql`).
- `ActionFooter.tsx` gates each button by `reservationStatus` (lines 65–68) — same pattern for the invoice button.
- RLS is enabled on all tables; new `invoices` table needs its own policy (authenticated full access follows the project pattern).

## What We're NOT Doing

- PDF generation (browser print → PDF is sufficient for MVP)
- VAT breakdown (net / gross / VAT%) — invoice shows `total_amount` as a flat amount
- Invoice list / archive view
- NIP validation via GUS/VIES API
- Sending invoice by email
- Cost recalculation from `daily_rate × 24h periods` (stored `total_cost` is used)
- Concurrent invoice-numbering protection (single-user MVP; advisory lock deferred to M-2)

## Implementation Approach

Five sequential phases: DB + migration first, then seller settings UI, then invoice API + service, then frontend pages, then wiring into reservation details. Each phase is independently verifiable before the next begins.

## Critical Implementation Details

**Days count**: `days_count = CEIL(EXTRACT(EPOCH FROM (actual_check_out - actual_check_in)) / 86400)`. Minimum 1. If either actual timestamp is NULL (edge case for legacy data), fall back to `date_diff(planned_check_out, planned_check_in)`.

**Invoice numbering**: Derive year and month from server time at creation. Get next seq with `SELECT COALESCE(MAX(invoice_seq), 0) + 1 FROM invoices WHERE invoice_year = $year AND invoice_month = $month`. Format as `FV/${year}/${String(month).padStart(2,'0')}/${String(seq).padStart(3,'0')}`. Store `invoice_year`, `invoice_month`, `invoice_seq` separately alongside `invoice_number` for querying.

**Seller data snapshot**: Fetch all four seller settings at invoice creation time and snapshot them into the invoice row. Old invoices are unaffected if seller data changes later.

**Print isolation**: The print view page must include `@media print { .no-print { display: none; } }` and apply `.no-print` to the navigation, print button, and any non-invoice chrome.

---

## Phase 1: DB Foundation

### Overview

Create the `invoices` table and seed empty seller settings rows. Pure SQL — no application code changes.

### Changes Required

#### 1. DB Migration

**File**: `supabase/migrations/20260901120000_add_invoices_and_seller_settings.sql`

**Intent**: Create the invoices table with all required columns and RLS, then insert four seller settings rows.

**Contract**:

`invoices` columns:
- `id uuid DEFAULT gen_random_uuid() PRIMARY KEY`
- `reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE RESTRICT`
- `CONSTRAINT unique_invoice_per_reservation UNIQUE (reservation_id)`
- `invoice_number text NOT NULL UNIQUE` — e.g. `FV/2026/09/001`
- `invoice_year integer NOT NULL`
- `invoice_month integer NOT NULL`
- `invoice_seq integer NOT NULL`
- `seller_name text NOT NULL`
- `seller_address text NOT NULL`
- `seller_nip text NOT NULL`
- `seller_bank_account text NOT NULL`
- `buyer_name text NOT NULL`
- `buyer_nip text NOT NULL`
- `buyer_address text NOT NULL`
- `buyer_email text` (nullable)
- `total_amount numeric(10,2) NOT NULL`
- `days_count integer NOT NULL`
- `daily_rate_snapshot numeric(10,2) NOT NULL`
- `created_at timestamptz DEFAULT now()`
- `created_by uuid REFERENCES auth.users(id) NOT NULL`

RLS: `ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;` + `CREATE POLICY "Authenticated users full access" ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);`

Seller settings (use `get_system_user()` for `updated_by`, `ON CONFLICT (key) DO NOTHING`):
```sql
INSERT INTO public.settings (key, value, description, updated_by) VALUES
  ('seller_name',         '""', 'Nazwa firmy (sprzedawca na fakturze)',    get_system_user()),
  ('seller_address',      '""', 'Adres firmy (sprzedawca)',                get_system_user()),
  ('seller_nip',          '""', 'NIP firmy (sprzedawca)',                  get_system_user()),
  ('seller_bank_account', '""', 'Numer konta bankowego (sprzedawca)',      get_system_user())
ON CONFLICT (key) DO NOTHING;
```

### Success Criteria

#### Automated Verification

- Migration applies cleanly: `npx supabase db push`
- No TypeScript errors after regenerating or updating types: `npm run build`

#### Manual Verification

- Supabase Table Editor shows `invoices` table with all expected columns
- Settings table shows 4 new `seller_*` rows with empty-string JSONB values (`""`)

---

## Phase 2: Seller Settings UI

### Overview

Extend `/ustawienia` to include a "Dane sprzedawcy" section with four new fields. Staff fills these in once before generating any invoice.

### Changes Required

#### 1. Types

**File**: `src/types.ts`

**Intent**: Add or extend the settings form types to include seller fields.

**Contract**: Locate the existing `SettingsFormData` type (or the inline type used in SettingsForm). Add four required string fields: `seller_name`, `seller_address`, `seller_nip`, `seller_bank_account`. Also add four optional-string props to `SettingsFormProps` (or whatever interface SettingsForm accepts for initial values): `initialSellerName`, `initialSellerAddress`, `initialSellerNip`, `initialSellerBankAccount`.

#### 2. SettingsForm component

**File**: `src/components/settings/SettingsForm.tsx`

**Intent**: Add a "Dane sprzedawcy" section below existing pricing fields with four text inputs, and extend the submit handler to PATCH the four new settings keys.

**Contract**: The Zod schema gains four new `z.string().min(1, ...)` fields. The `onSubmit` `Promise.all` gains four more parallel PATCH calls to `/api/settings?key=eq.seller_name` etc. The new section is wrapped in a visual separator or heading for clarity. Props: `initialSellerName: string`, `initialSellerAddress: string`, `initialSellerNip: string`, `initialSellerBankAccount: string`.

#### 3. Settings Astro page

**File**: `src/pages/ustawienia.astro`

**Intent**: Fetch the four new seller settings server-side and pass them as initial props to SettingsForm.

**Contract**: Add four parallel `supabase.from('settings').select('value').eq('key', 'seller_*').maybeSingle()` calls alongside existing fetches. Parse each value: `typeof v === 'string' ? v : ''`. Pass as props to `<SettingsForm ... />` with empty-string fallback.

### Success Criteria

#### Automated Verification

- No TypeScript errors: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification

- `/ustawienia` loads with a "Dane sprzedawcy" section showing four empty fields
- Filling and saving seller data persists (page reload confirms values retained)
- Existing `daily_rate` and `total_parking_spots` fields still work correctly

---

## Phase 3: Invoice Backend

### Overview

New `InvoiceService`, Zod schema, and two API route files: `GET/POST /api/invoices` (list/create by reservation) and `GET /api/invoices/[id]` (fetch by invoice ID for the print page).

### Changes Required

#### 1. Types

**File**: `src/types.ts`

**Intent**: Add invoice DTOs and command model shared by frontend and backend.

**Contract**:
```ts
export interface InvoiceDto {
  id: string;
  reservation_id: string;
  invoice_number: string;
  invoice_year: number;
  invoice_month: number;
  invoice_seq: number;
  seller_name: string;
  seller_address: string;
  seller_nip: string;
  seller_bank_account: string;
  buyer_name: string;
  buyer_nip: string;
  buyer_address: string;
  buyer_email: string | null;
  total_amount: number;
  days_count: number;
  daily_rate_snapshot: number;
  created_at: string;
  created_by: string;
}

export interface CreateInvoiceCommand {
  reservation_id: string;
  buyer_name: string;
  buyer_nip: string;
  buyer_address: string;
  buyer_email?: string;
}
```

#### 2. Invoice Zod schema

**File**: `src/lib/schemas/invoice.schema.ts` (new file)

**Intent**: Validate the POST /api/invoices request body at the API boundary.

**Contract**:
```ts
export const createInvoiceSchema = z.object({
  reservation_id: z.string().uuid(),
  buyer_name: z.string().min(1),
  buyer_nip: z.string().min(1),
  buyer_address: z.string().min(1),
  buyer_email: z.string().email().optional(),
});
```

#### 3. InvoiceService

**File**: `src/lib/services/invoice.service.ts` (new file)

**Intent**: Encapsulate all invoice business logic — lookup, creation, numbering — keeping API handlers thin.

**Contract**: Class `InvoiceService` with constructor `(supabase: SupabaseClient)`.

Methods:
- `getByReservationId(reservationId: string): Promise<InvoiceDto | null>` — SELECT from `invoices` WHERE `reservation_id = ?`; return null if not found.
- `getById(id: string): Promise<InvoiceDto | null>` — SELECT from `invoices` WHERE `id = ?`; return null if not found.
- `create(cmd: CreateInvoiceCommand): Promise<InvoiceDto>` — full creation flow:
  1. Fetch reservation; throw `ReservationNotFoundError` if missing, `ReservationNotCompletedError` if status ≠ `'completed'`
  2. Check for existing invoice; throw `DuplicateInvoiceError` if found
  3. Fetch seller settings (4 keys) and `daily_rate` setting via parallel selects
  4. Calculate `days_count`: `Math.max(1, Math.ceil((actualOut - actualIn) / 86400000))` using actual timestamps; fall back to planned date diff if actual timestamps are null
  5. Get monthly seq: `SELECT COALESCE(MAX(invoice_seq), 0) + 1 FROM invoices WHERE invoice_year = $year AND invoice_month = $month`
  6. Build `invoice_number`: `FV/${year}/${String(month).padStart(2,'0')}/${String(seq).padStart(3,'0')}`
  7. INSERT invoice row; return created record

Seller settings values are JSONB strings — parse each with `typeof v === 'string' ? v : String(v)`.

The three custom error classes (`ReservationNotFoundError`, `ReservationNotCompletedError`, `DuplicateInvoiceError`) extend `Error` and are thrown from the service; the API handler maps them to HTTP status codes.

#### 4. Invoice API — main route

**File**: `src/pages/api/invoices.ts` (new file)

**Intent**: Handle GET (check/fetch invoice by reservation) and POST (create invoice).

**Contract**: `export const prerender = false`. Named exports `GET` and `POST`.

`GET`: query param `reservation_id` (required, must be a valid UUID — reject with 400 otherwise). Call `service.getByReservationId(...)`. Return 200 + InvoiceDto or 404 if not found.

`POST`: parse JSON body, validate with `createInvoiceSchema.safeParse` (400 on failure). Call `service.create(cmd)`. Return 201 + InvoiceDto. Map service errors: `ReservationNotFoundError` → 404, `ReservationNotCompletedError` → 422, `DuplicateInvoiceError` → 409. Catch-all → 500.

#### 5. Invoice API — by ID

**File**: `src/pages/api/invoices/[id].ts` (new file)

**Intent**: Retrieve single invoice by ID for the print page.

**Contract**: `export const prerender = false`. Named export `GET`. Extract `params.id`, validate UUID format (400 if invalid). Call `service.getById(id)`. Return 200 + InvoiceDto or 404.

### Success Criteria

#### Automated Verification

- No TypeScript errors: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification

- `POST /api/invoices` with valid body for a completed reservation → 201 + invoice with `invoice_number = FV/2026/09/001`
- Second `POST` for the same reservation → 409
- `POST` for a non-completed reservation → 422
- `POST` for a non-existent reservation → 404
- `GET /api/invoices?reservation_id=...` after creation → 200 + invoice data
- `GET /api/invoices/[id]` → 200 + invoice data

---

## Phase 4: Invoice Pages

### Overview

Two Astro SSR pages: `/faktury/nowy` (form page with React InvoiceForm) and `/faktury/[id]/druk` (static print view, no client-side React).

### Changes Required

#### 1. InvoiceForm React component

**File**: `src/components/invoices/InvoiceForm.tsx` (new file)

**Intent**: Interactive form for buyer data. On submit, POSTs to `/api/invoices` and redirects to the print view.

**Contract**: Props: `reservationId: string; reservationSummary: { lastName: string; firstName: string | null; plannedCheckIn: string; plannedCheckOut: string; totalCost: number; }`. Fields: `buyer_name` (required), `buyer_nip` (required), `buyer_address` (required), `buyer_email` (optional). Uses `react-hook-form` + Zod resolver (follow pattern in existing reservation form components). On submit, `fetch('POST /api/invoices', ...)`. On 201: `window.location.href = /faktury/${data.id}/druk`. On 4xx: display inline error message.

#### 2. Invoice form Astro page

**File**: `src/pages/faktury/nowy.astro` (new file)

**Intent**: SSR page that reads `reservationId` from URL query, fetches reservation data, and renders the InvoiceForm.

**Contract**: `export const prerender = false`. Server block: read `Astro.url.searchParams.get('reservationId')`. If missing or not a valid UUID — redirect to `/`. Fetch reservation via `context.locals.supabase`. If not found or `status !== 'completed'` — redirect to `/`. Check if invoice already exists (`GET /api/invoices?reservation_id=...` or direct supabase query); if yes — redirect to `/faktury/${invoice.id}/druk`. Render page with `<InvoiceForm client:load ... />`.

#### 3. Invoice print view Astro page

**File**: `src/pages/faktury/[id]/druk.astro` (new file)

**Intent**: SSR page that fetches an invoice by ID and renders a static, print-optimized HTML invoice. No React.

**Contract**: `export const prerender = false`. Server block: extract `Astro.params.id`, validate UUID (redirect to `/` if invalid). Fetch invoice via `context.locals.supabase` from `invoices` table WHERE `id = ?`. If not found — return 404 response. Also fetch the associated reservation for `is_paid` and date display.

Page structure:
1. `<style>` block with `@media print { .no-print { display: none; } body { font-size: 12pt; } }` and print-friendly layout styles
2. `.no-print` bar: "Drukuj" button (`onclick="window.print()"`) + link back to reservation
3. Invoice document:
   - Header: "FAKTURA VAT" + `invoice_number` + `Wystawiono: {created_at date}`
   - Two-column seller / buyer boxes
   - Line item table: Lp | Nazwa usługi | Ilość | J.m. | Cena jedn. | Wartość
     - Row: 1 | "Usługa parkingowa – {planned_check_in date} – {planned_check_out date}" | `{days_count}` | "dzień" | `{daily_rate_snapshot} PLN` | `{total_amount} PLN`
   - Total row: `Razem: {total_amount} PLN`
   - Footer: status płatności based on `reservation.is_paid`

### Success Criteria

#### Automated Verification

- No TypeScript errors: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification

- `/faktury/nowy?reservationId=[valid-completed-id]` loads with correct reservation summary
- `/faktury/nowy?reservationId=[non-existent-id]` redirects to `/`
- `/faktury/nowy?reservationId=[non-completed-id]` redirects to `/`
- `/faktury/nowy?reservationId=[already-has-invoice]` redirects to `/faktury/[id]/druk`
- Filling form and submitting creates invoice and redirects to `/faktury/[id]/druk`
- Print view displays all invoice data correctly (seller, buyer, line item, total)
- `window.print()` opens browser print dialog; print preview shows only invoice content

---

## Phase 5: Reservation Detail Integration

### Overview

Add invoice state to the reservation details hook and wire the "Generuj fakturę" / "Pokaż fakturę" button into ActionFooter.

### Changes Required

#### 1. Types

**File**: `src/types.ts`

**Intent**: Extend `ActionFooterProps` to include invoice-related props.

**Contract**: Add to `ActionFooterProps`:
```ts
existingInvoiceId: string | null;
reservationId: string;
```

#### 2. useReservationDetails hook

**File**: `src/hooks/useReservationDetails.ts`

**Intent**: After fetching the reservation, also fetch any existing invoice. Expose `existingInvoice: InvoiceDto | null` in the hook's return value.

**Contract**: Add a parallel fetch to `GET /api/invoices?reservation_id=${reservationId}` alongside the existing reservation fetch. Store result as `existingInvoice` state (null on 404 or error). Expose in the return object. The fetch fires on mount and re-fires whenever `fetchReservation` is called (same trigger as the reservation refetch after actions).

#### 3. ActionFooter component

**File**: `src/components/reservations/details/ActionFooter.tsx`

**Intent**: Show an invoice action button for completed reservations.

**Contract**: Accept new props `existingInvoiceId: string | null` and `reservationId: string`. When `status === 'completed'`:
- If `existingInvoiceId` is null: render `<a href={/faktury/nowy?reservationId=${reservationId}}>` wrapping a `<Button>Generuj fakturę</Button>`
- If `existingInvoiceId` is set: render `<a href={/faktury/${existingInvoiceId}/druk}>` wrapping a `<Button variant="outline">Pokaż fakturę</Button>`

For non-completed statuses, render nothing for the invoice slot.

#### 4. ReservationDetailsView component

**File**: `src/components/reservations/details/ReservationDetailsView.tsx`

**Intent**: Thread `existingInvoice` and `reservationId` from the hook into ActionFooter.

**Contract**: Destructure `existingInvoice` from `useReservationDetails()` return. Pass `existingInvoiceId={existingInvoice?.id ?? null}` and `reservationId={reservationId}` to `<ActionFooter />`.

### Success Criteria

#### Automated Verification

- No TypeScript errors: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification

- Completed reservation detail view shows "Generuj fakturę" button
- Clicking the button navigates to `/faktury/nowy?reservationId=...`
- After generating an invoice and re-opening the reservation detail, "Pokaż fakturę" appears
- "Pokaż fakturę" navigates to `/faktury/[id]/druk` with correct invoice
- Non-completed reservation shows no invoice button

---

## Testing Strategy

### Manual Testing Steps

1. Configure seller data in `/ustawienia` — save — reload and verify all four fields persist
2. Open a completed reservation — verify "Generuj fakturę" appears in footer
3. Click "Generuj fakturę" — `/faktury/nowy` loads with correct reservation summary
4. Fill buyer name, NIP, address — submit — verify redirect to `/faktury/[id]/druk`
5. Print view shows: `FV/2026/09/001`, seller data, buyer data, line item, correct total
6. Click "Drukuj" — browser print dialog opens; preview shows only invoice (no nav)
7. Re-open the same reservation detail — "Pokaż fakturę" appears (not "Generuj")
8. "Pokaż fakturę" links to the correct print view
9. Open a confirmed (not completed) reservation — no invoice button visible
10. Direct `POST /api/invoices` for same reservation a second time → 409

## Migration Notes

- Fully additive — no changes to existing tables
- `invoices.daily_rate_snapshot` is a point-in-time copy; not linked to future settings changes
- `invoices.total_amount` is a point-in-time copy of `reservations.total_cost` at creation time
- Seller settings default to empty JSON string `""` — staff must populate before first invoice
- No invoice delete endpoint in MVP; invoices are immutable once created

## References

- Roadmap slice S-03: `context/foundation/roadmap.md`
- PRD FR-008–FR-011, FR-013–FR-014, US-01: `context/foundation/prd.md`
- ActionFooter pattern: `src/components/reservations/details/ActionFooter.tsx`
- Settings form pattern: `src/components/settings/SettingsForm.tsx`
- InvoiceService pattern (follow): `src/lib/services/reservation.service.ts`
- Admin client pattern: `src/lib/supabase-admin.ts`
- Initial schema migration (get_system_user reference): `supabase/migrations/20251017120000_initial_schema.sql`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: DB Foundation

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db push` — d8ac35f
- [x] 1.2 No TypeScript errors: `npm run build` — d8ac35f

#### Manual

- [x] 1.3 invoices table visible in Supabase Table Editor with all expected columns — d8ac35f
- [x] 1.4 Settings table shows 4 new seller_* rows with empty-string JSONB values — d8ac35f

### Phase 2: Seller Settings UI

#### Automated

- [x] 2.1 No TypeScript errors: `npm run build` — 37d144e
- [x] 2.2 Linting passes: `npm run lint` — 37d144e

#### Manual

- [x] 2.3 /ustawienia loads with Dane sprzedawcy section showing 4 fields — 37d144e
- [x] 2.4 Saving seller data persists after page reload — 37d144e
- [x] 2.5 Existing daily_rate and total_parking_spots fields still work — 37d144e

### Phase 3: Invoice Backend

#### Automated

- [x] 3.1 No TypeScript errors: `npm run build` — 46597ff
- [x] 3.2 Linting passes: `npm run lint` — 46597ff

#### Manual

- [x] 3.3 POST /api/invoices for completed reservation returns 201 + FV/2026/09/001 — 46597ff
- [x] 3.4 Second POST for same reservation returns 409 — 46597ff
- [x] 3.5 POST for non-completed reservation returns 422 — 46597ff
- [x] 3.6 POST for non-existent reservation returns 404 — 46597ff
- [x] 3.7 GET /api/invoices?reservation_id=... returns 200 + invoice data — 46597ff
- [x] 3.8 GET /api/invoices/[id] returns 200 + invoice data — 46597ff

### Phase 4: Invoice Pages

#### Automated

- [x] 4.1 No TypeScript errors: `npm run build`
- [x] 4.2 Linting passes: `npm run lint`

#### Manual

- [x] 4.3 /faktury/nowy?reservationId=[valid-completed] loads with reservation summary
- [x] 4.4 /faktury/nowy?reservationId=[missing or invalid] redirects to /
- [x] 4.5 /faktury/nowy?reservationId=[already-has-invoice] redirects to print view
- [x] 4.6 Form submit creates invoice and redirects to /faktury/[id]/druk
- [x] 4.7 Print view shows all invoice data correctly
- [x] 4.8 Print preview shows only invoice content (no navigation, no print button)

### Phase 5: Reservation Detail Integration

#### Automated

- [ ] 5.1 No TypeScript errors: `npm run build`
- [ ] 5.2 Linting passes: `npm run lint`

#### Manual

- [ ] 5.3 Completed reservation detail shows Generuj fakturę button
- [ ] 5.4 After invoice created, reservation detail shows Pokaż fakturę link
- [ ] 5.5 Non-completed reservation shows no invoice button
