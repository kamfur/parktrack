-- Migration: Update arrivals/departures functions to return nearest upcoming events
-- Instead of filtering by today only, returns all events from the nearest future date

create or replace function public.get_todays_arrivals()
returns setof reservations as $$
declare
  v_next_date date;
begin
  select date(planned_check_in) into v_next_date
  from public.reservations
  where date(planned_check_in) >= current_date
    and status = 'confirmed'
  order by planned_check_in asc
  limit 1;

  if v_next_date is null then
    return;
  end if;

  return query
  select *
  from public.reservations
  where date(planned_check_in) = v_next_date
    and status = 'confirmed'
  order by planned_check_in asc;
end;
$$ language plpgsql security definer;

create or replace function public.get_todays_departures()
returns setof reservations as $$
declare
  v_next_date date;
begin
  select date(planned_check_out) into v_next_date
  from public.reservations
  where date(planned_check_out) >= current_date
    and status = 'in_progress'
  order by planned_check_out asc
  limit 1;

  if v_next_date is null then
    return;
  end if;

  return query
  select *
  from public.reservations
  where date(planned_check_out) = v_next_date
    and status = 'in_progress'
  order by planned_check_out asc;
end;
$$ language plpgsql security definer;
