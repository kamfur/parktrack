-- Migration: price an individual stay by the actual arrival
-- Affected: update_reservation_cost() (trg_update_cost)
-- Intent: the binding price list is the one in force on the day the car actually arrives, and the
--         stay length is counted from the actual check-in. So for individual clients:
--           * once actual_check_in is set, every repricing uses it instead of planned_check_in;
--           * recording the arrival (actual_check_in set / changed) reprices the stay, but only
--             while it is unpaid — a stay already paid keeps the amount the client paid.
--         A date or parking type change still reprices as before (the driver then collects the
--         quoted amount). Agency stays are unchanged: always derived from the planned dates.

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
      or new.parking_type is distinct from old.parking_type;
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
      );
    end if;
    if v_agency_changed then
      new.is_paid := new.paid_at_arrival or new.paid_at_departure;
    end if;
  end if;

  return new;
end;
$$;
