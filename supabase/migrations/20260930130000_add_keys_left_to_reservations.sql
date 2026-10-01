-- Migration: "Zostawił kluczyki" flag recorded at arrival
-- Intent: the driver ticks whether the client left the car keys when checking the car in,
--         so whoever handles the return knows the keys are with the parking staff.
--         Drivers may set it: enforce_driver_reservation_update() only blocks identity /
--         non-operational columns, so no trigger change is needed.

alter table public.reservations
  add column keys_left boolean not null default false;

comment on column public.reservations.keys_left is
  'True when the client left the car keys with the parking at arrival (set by the driver at check-in).';
