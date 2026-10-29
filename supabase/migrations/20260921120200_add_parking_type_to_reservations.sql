-- Migration: Reservation parking type flag
-- Intent: flag which reservations request a garage/carport spot vs a regular
--         open-air spot, without changing existing rows' behavior
--         (garage-carport-slots change, phase 1)

alter table public.reservations
  add column parking_type text not null default 'open_air'
  check (parking_type in ('open_air', 'garage'));

comment on column public.reservations.parking_type is
  'open_air (default, existing behavior) or garage (requires a garage_assignments row).';
