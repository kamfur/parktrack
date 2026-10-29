-- Migration: Add driver operation fields to reservations
-- Purpose: Support mobile driver module (passenger count, sector, payment timing, surcharge)
-- Affected: public.reservations
-- Special considerations: Existing rows get safe defaults; is_paid remains for invoicing sync in later phases

alter table public.reservations
  add column if not exists passenger_count integer null,
  add column if not exists parking_sector text null,
  add column if not exists paid_at_arrival boolean not null default false,
  add column if not exists paid_at_departure boolean not null default false,
  add column if not exists surcharge_amount numeric(10, 2) null;

comment on column public.reservations.passenger_count is 'Number of passengers recorded at arrival (driver ops)';
comment on column public.reservations.parking_sector is 'Free-text parking sector / spot label (driver ops)';
comment on column public.reservations.paid_at_arrival is 'Payment collected by driver at arrival';
comment on column public.reservations.paid_at_departure is 'Payment collected by driver at departure';
comment on column public.reservations.surcharge_amount is 'Dopłata amount when stay extended beyond planned checkout';
