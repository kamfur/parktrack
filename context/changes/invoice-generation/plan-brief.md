# Plan Brief: Invoice Generation

## What We're Building

Staff opens a completed reservation, clicks "Generuj fakturę", fills in buyer company data (name, NIP, address, optional email), and gets a sequential Polish VAT invoice (`FV/{rok}/{miesiąc}/{numer}`) with a browser-printable view. Seller data (parking company name, address, NIP, bank account) is configured once in `/ustawienia`. Re-opening the same reservation shows "Pokaż fakturę" instead.

## 5-Phase Approach

| Phase | What | Key files |
|---|---|---|
| 1 | DB migration: `invoices` table + 4 seller settings rows | `supabase/migrations/20260901120000_add_invoices_and_seller_settings.sql` |
| 2 | Seller settings UI in `/ustawienia` | `src/types.ts`, `src/components/settings/SettingsForm.tsx`, `src/pages/ustawienia.astro` |
| 3 | Invoice backend: InvoiceService + 2 API routes | `src/lib/services/invoice.service.ts`, `src/lib/schemas/invoice.schema.ts`, `src/pages/api/invoices.ts`, `src/pages/api/invoices/[id].ts` |
| 4 | Invoice pages: form + print view | `src/components/invoices/InvoiceForm.tsx`, `src/pages/faktury/nowy.astro`, `src/pages/faktury/[id]/druk.astro` |
| 5 | Wire into reservation detail (hook + ActionFooter) | `src/hooks/useReservationDetails.ts`, `src/components/reservations/details/ActionFooter.tsx`, `src/components/reservations/details/ReservationDetailsView.tsx` |

## Key Decisions

- **Cost source**: `reservations.total_cost` (stored, computed by tiered pricing RPC) is the authoritative billed amount. `days_count` (24h periods from actual timestamps) and `daily_rate_snapshot` (from settings) appear as informational line items only.
- **Invoice number**: `FV/{year}/{month padded}/{seq padded}` — monthly sequence, derived at creation time from `MAX(invoice_seq)` for that year+month.
- **Seller data**: stored as 4 new rows in the `settings` table, snapshotted into each invoice row at creation time.
- **Print isolation**: pure Astro SSR page with `@media print { .no-print { display: none; } }` — no React, no client-side JS needed.
- **Duplicate guard**: `UNIQUE (reservation_id)` constraint on `invoices` table; service throws `DuplicateInvoiceError` → 409.

## What's NOT in Scope

PDF generation, VAT breakdown, invoice list view, NIP API validation, email sending, concurrent numbering protection.
