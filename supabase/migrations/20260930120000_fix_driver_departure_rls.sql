-- Migration: let drivers finish departures and enter a license plate at arrival.
--
-- 1. "Drivers can select reservations" only allowed confirmed/in_progress rows, so completing a
--    departure (UPDATE … RETURNING via PostgREST) failed with 42501: the returned row is already
--    'completed' and invisible to the driver. It also hid the "handled" departures list.
--    Drivers now also see stays completed within the last 2 days (covers the 12h handled window).
-- 2. enforce_driver_reservation_update() froze license_plate, breaking the driver arrival form
--    that lets the driver fill in the plate. It is now editable while confirming arrival only.

drop policy if exists "Drivers can select reservations" on public.reservations;
create policy "Drivers can select reservations"
  on public.reservations for select
  to authenticated
  using (
    public.is_driver_role()
    and (
      status in ('confirmed', 'in_progress')
      or (status = 'completed' and actual_check_out >= now() - interval '2 days')
    )
  );

-- Body copied from 20260929140000_agency_reservations.sql; only the license_plate rule changed.
create or replace function public.enforce_driver_reservation_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_driver_role() then
    return new;
  end if;

  if old.status = 'confirmed' and new.status not in ('confirmed', 'in_progress') then
    raise exception 'drivers may only move confirmed reservations to in_progress'
      using errcode = '42501';
  end if;

  if old.status = 'in_progress' and new.status not in ('in_progress', 'completed') then
    raise exception 'drivers may only move in_progress reservations to completed'
      using errcode = '42501';
  end if;

  if old.status not in ('confirmed', 'in_progress') then
    raise exception 'drivers cannot update reservations in status %', old.status
      using errcode = '42501';
  end if;

  -- Allowlist: operational driver fields + timestamps the existing triggers maintain.
  if new.id is distinct from old.id
     or new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by
     or new.last_name is distinct from old.last_name
     or new.first_name is distinct from old.first_name
     or new.email is distinct from old.email
     or new.phone is distinct from old.phone
     or (new.license_plate is distinct from old.license_plate and old.status <> 'confirmed')
     or new.planned_check_in is distinct from old.planned_check_in
     or new.source is distinct from old.source
     or new.travel_agency_id is distinct from old.travel_agency_id
     or new.agency_discount_pct is distinct from old.agency_discount_pct
  then
    raise exception 'drivers cannot modify identity or non-operational reservation columns'
      using errcode = '42501';
  end if;

  -- Ignore client-supplied total_cost; trg_update_cost may overwrite after date edits.
  new.total_cost := old.total_cost;
  new.last_modified_by := auth.uid();

  return new;
end;
$$;
