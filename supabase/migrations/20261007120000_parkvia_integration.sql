-- Migration: ParkVia (ParkCloud Operator API) booking import
-- Affected: reservations (columns), parkvia_sync_state (new), update_reservation_cost()
-- Intent: bookings sold on ParkVia are pulled hourly and kept in sync (new / amend / cancel / no-show).
--           * external_source + external_reference identify the booking; the unique index makes the
--             import idempotent across reruns and app instances;
--           * the price comes from ParkVia (what the customer paid), so the cost trigger no longer
--             re-prices externally sourced stays from our price lists;
--           * parkvia_sync_state keeps the last processed ParkCloud event id per operator.

alter table public.reservations
  add column external_source text,
  add column external_reference text,
  add constraint reservations_external_ref_pair
    check ((external_source is null) = (external_reference is null));

create unique index reservations_external_ref_unique
  on public.reservations (external_source, external_reference)
  where external_reference is not null;

comment on column public.reservations.external_source is
  'Sales channel the reservation was imported from (e.g. ''parkvia''); null for reservations created in ParkTrack.';
comment on column public.reservations.external_reference is
  'Booking reference in the external channel (e.g. ParkVia ''PC90855387'').';

create table public.parkvia_sync_state (
  operator_id text primary key,
  last_event_id bigint,
  last_run_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

comment on table public.parkvia_sync_state is
  'ParkVia import cursor per ParkCloud operator; written only by the server (service role).';

-- Service role only: no policies, so authenticated and anon clients see nothing.
alter table public.parkvia_sync_state enable row level security;

-- Body copied from 20261005120000_add_vehicle_count.sql; only externally sourced stays are new:
-- their total_cost is whatever the importer writes (no re-pricing from our price lists).
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
  elsif tg_op = 'UPDATE' and new.external_source is null then
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
