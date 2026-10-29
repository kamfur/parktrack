-- Migration: reservations for several cars
-- Affected: reservations (columns), update_reservation_cost(), enforce_driver_reservation_update()
-- Intent: one reservation can cover several cars (business-wise it is still one reservation).
--           * vehicle_count multiplies the price list amount (before the agency discount);
--           * license_plate stays the first car's plate, extra_license_plates holds the others;
--           * drivers may change both only while confirming the arrival (status 'confirmed').
--         The surcharge stays a flat amount, it is not multiplied.

alter table public.reservations
  add column vehicle_count integer not null default 1
    constraint reservations_vehicle_count_range check (vehicle_count between 1 and 10),
  add column extra_license_plates text[] not null default '{}'
    constraint reservations_extra_plates_within_count
      check (cardinality(extra_license_plates) <= vehicle_count - 1);

comment on column public.reservations.vehicle_count is
  'Number of cars covered by the reservation; total_cost = price list amount x vehicle_count.';
comment on column public.reservations.extra_license_plates is
  'License plates of cars 2..vehicle_count (car 1 is license_plate); may hold fewer entries than cars until the arrival.';

-- Body copied from 20261002120000_price_at_actual_arrival.sql; every price list amount is now
-- multiplied by vehicle_count, and a vehicle_count change counts as a stay change.
create or replace function public.update_reservation_cost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency record;
  v_agency_changed boolean;
  v_stay_changed boolean;
  v_arrival_recorded boolean;
begin
  if tg_op = 'INSERT' then
    v_agency_changed := new.travel_agency_id is not null;
    v_stay_changed := true;
    v_arrival_recorded := false;
  else
    v_agency_changed := new.travel_agency_id is distinct from old.travel_agency_id;
    v_stay_changed := new.planned_check_in is distinct from old.planned_check_in
      or new.planned_check_out is distinct from old.planned_check_out
      or new.parking_type is distinct from old.parking_type
      or new.vehicle_count is distinct from old.vehicle_count;
    v_arrival_recorded := new.actual_check_in is not null
      and new.actual_check_in is distinct from old.actual_check_in;
  end if;

  -- Discount snapshot: taken from the agency on assignment only; clients cannot set it.
  if v_agency_changed and new.travel_agency_id is not null then
    select a.discount_pct, a.archived_at
      into v_agency
      from public.travel_agencies a
     where a.id = new.travel_agency_id;
    if not found then
      raise exception 'AGENCY_NOT_FOUND: %', new.travel_agency_id using errcode = 'P0001';
    end if;
    if v_agency.archived_at is not null then
      raise exception 'AGENCY_ARCHIVED: %', new.travel_agency_id using errcode = 'P0001';
    end if;
    new.agency_discount_pct := v_agency.discount_pct;
  elsif new.travel_agency_id is null then
    new.agency_discount_pct := null;
  else
    new.agency_discount_pct := old.agency_discount_pct;
  end if;

  if new.travel_agency_id is not null then
    -- Agency pays: price is always derived (client-sent total_cost ignored).
    if v_agency_changed or v_stay_changed then
      new.total_cost := round(
        public.calculate_total_cost(new.planned_check_in, new.planned_check_out, new.parking_type)
          * new.vehicle_count
          * (1 - new.agency_discount_pct / 100),
        2
      );
    else
      new.total_cost := old.total_cost;
    end if;
    new.is_paid := true;
    new.paid_at_arrival := false;
    new.paid_at_departure := false;
    new.surcharge_amount := null;
  elsif tg_op = 'UPDATE' then
    -- Individual client: reprice on stay change, or when the arrival is recorded on an unpaid stay.
    -- Counted from the actual arrival once known; plus full price and driver-derived paid flag
    -- when an agency was just removed.
    if v_stay_changed or v_agency_changed or (v_arrival_recorded and not new.is_paid) then
      new.total_cost := public.calculate_total_cost(
        coalesce(new.actual_check_in, new.planned_check_in), new.planned_check_out, new.parking_type
      ) * new.vehicle_count;
    end if;
    if v_agency_changed then
      new.is_paid := new.paid_at_arrival or new.paid_at_departure;
    end if;
  end if;

  return new;
end;
$$;

-- Body copied from 20260930120000_fix_driver_departure_rls.sql; only the vehicle rules are new.
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
     or (new.extra_license_plates is distinct from old.extra_license_plates and old.status <> 'confirmed')
     or (new.vehicle_count is distinct from old.vehicle_count and old.status <> 'confirmed')
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
