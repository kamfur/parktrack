-- One-off cleanup: delete reservations created before 2026-09-23 (Europe/Warsaw).
-- NOT a migration — run manually (Supabase SQL editor / psql) against the target DB.
--
-- Dependent rows:
--   payments            -> ON DELETE CASCADE (removed automatically)
--   garage_assignments  -> no cascade, deleted explicitly below
--   invoice_items       -> ON DELETE RESTRICT; their invoices are deleted explicitly below (!)
--                          (items cascade with the invoice; since migration 20260929120000)
--
-- Run step 1 first and check the counts. The transaction ends with ROLLBACK;
-- change it to COMMIT once the numbers look right.

-- 1. Preview ---------------------------------------------------------------
with target as (
  select id from public.reservations
  where created_at < timestamptz '2026-09-23 00:00:00 Europe/Warsaw'
)
select
  (select count(*) from target)                                                          as reservations,
  (select count(*) from public.payments p           where p.reservation_id in (select id from target)) as payments,
  (select count(*) from public.garage_assignments g where g.reservation_id in (select id from target)) as garage_assignments,
  (select count(distinct it.invoice_id) from public.invoice_items it where it.reservation_id in (select id from target)) as invoices;

-- 2. Delete ----------------------------------------------------------------
begin;

create temp table _reservations_to_delete on commit drop as
  select id from public.reservations
  where created_at < timestamptz '2026-09-23 00:00:00 Europe/Warsaw';

delete from public.invoices
  where id in (
    select it.invoice_id from public.invoice_items it
    where it.reservation_id in (select id from _reservations_to_delete)
  );

delete from public.garage_assignments
  where reservation_id in (select id from _reservations_to_delete);

-- payments go via ON DELETE CASCADE
delete from public.reservations
  where id in (select id from _reservations_to_delete);

select count(*) as remaining_old_reservations
from public.reservations
where created_at < timestamptz '2026-09-23 00:00:00 Europe/Warsaw';

rollback;  -- change to COMMIT after verifying
