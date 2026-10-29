---
change_id: travel-agencies
title: Travel agencies — agency reservations and monthly VAT invoice per agency
status: implementing
created: 2026-09-28
updated: 2026-09-29
archived_at: null
---

## Notes

Decisions from grilling session (2026-09-28):

- **Money flow:** parking issues a VAT invoice to the agency for **all** its clients' reservations. The agency pays for everything; the client pays nothing on site.
- **Payment flag:** a reservation assigned to an agency is paid immediately (`is_paid = true`); the driver collects nothing.
- **What is invoiced:** only completed stays (confirmed arrival, `actual_check_in`). No-show and cancelled are not invoiced.
- **Billing month:** by arrival date (planned check-in month).
- **Price:** standard price list (`price_lists`, by parking type and number of days) minus the agency discount %. The price is computed and stored when the reservation is created, together with a discount snapshot, so changing the agency discount does not affect existing reservations.
- **Days:** booked package (`planned_check_in` → `planned_check_out`). **Extensions are not charged in v1.** Early return is not refunded.
- **Access:** staff only (internal module). Agencies get no accounts, no new role, no RLS for agencies.
- **Assignment:** optional "Travel agency" field in the reservation create and edit forms. API unchanged (`/api/reservations/external` stays on the shared key).
- **Invoice:** one invoice per agency per month, one line per reservation (surname, license plate, dates, days, net, VAT rate, VAT, gross), plus totals. Same numbering series `FV/YYYY/MM/NNN` as existing invoices.
- **VAT:** price list is gross. VAT rate 23% is a seller setting (Settings), not hardcoded. The current individual invoices print "FAKTURA VAT" without net/VAT/gross; fix them too (separate phase, because it changes existing documents).
- **After invoicing:** billing fields are locked on reservations already on an issued invoice: agency, planned dates, parking type, price, and cancellation. Operational fields stay editable (sector, notes, actual check-out). Corrections are handled outside the system (no correction invoices in v1).
- **Issuing:** manual button "Issue invoice for MM/YYYY", active only after the month has ended. It is **blocked** while the month has agency reservations with neither a confirmed arrival nor a no-show/cancelled status; the UI lists them so staff can resolve them. One invoice per agency per month.
- **Agency view (separate module):** agency list → agency detail with a month filter: reservation table (including arrival state per row), amount to invoice (net/VAT/gross, marking what is already invoiced), and the agency's invoice history with links to print. No status counters and no trends in v1.
- **Agency data (Settings):** required: name, NIP (checksum validation), address. Optional: email, phone, contact person, notes. Also discount % (0–100) and payment term in days (printed on the invoice). An agency with reservations cannot be deleted, only archived: it disappears from the form picker and its history stays.

Data model implications:

- New table `travel_agencies`; `reservations.travel_agency_id` (nullable FK) and `reservations.agency_discount_snapshot`.
- `invoices.reservation_id` is currently NOT NULL (1:1). A multi-line invoice needs an `invoice_items` table (and `invoices.travel_agency_id`, net/VAT/gross totals). Existing invoices must be migrated to one item each, and the print view (`src/pages/faktury/[id]/druk.astro`) rebuilt. This is the largest part of the change.

Out of scope (v1): charging extensions, correction invoices, per-agency API keys, agency login/portal, statistics and trends.

Accepted risks:

- Fixing VAT on existing individual invoices changes documents already issued; do it as a separate phase.
- With arrival-month billing and no extension charging, the agency does not pay for days beyond the booking until extension billing is added.
