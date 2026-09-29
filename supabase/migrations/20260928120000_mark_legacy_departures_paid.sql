-- Pre-go-live cars registered via the temporary "Dodaj wyjazd" form count as paid
-- unless staff marked them unpaid (new flag). Backfill rows created before that flag existed,
-- so the dashboard/driver lists do not show an amount due for them.
update public.reservations
set paid_at_arrival = true,
    is_paid = true
where notes like '[Migracja] Samochód na parkingu przed wdrożeniem systemu%'
  and status = 'in_progress'
  and is_paid = false;
