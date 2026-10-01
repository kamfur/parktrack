-- Migration: Period-based price lists
-- Intent: replace the tiered per-day `pricing_rules` (and the unused flat
--         `garage_spots.price_per_day` / `daily_rate` setting) with price lists
--         valid for a date range. Each list holds, per parking type
--         (open_air / carport / garage), the total price for a 1..14 day stay
--         plus a per-day price for every day beyond 14.
--
-- Price list precedence: the list covering the reservation's check-in date
-- (Europe/Warsaw) with the latest `valid_from` wins. That lets staff keep an
-- open-ended base list and layer a bounded one on top (e.g. 1 Feb – 15 May);
-- after the bounded list ends, the base list applies again.

-- 1. Reservations can request a carport separately from a garage.
alter table public.reservations drop constraint if exists reservations_parking_type_check;
alter table public.reservations
  add constraint reservations_parking_type_check
  check (parking_type in ('open_air', 'carport', 'garage'));

comment on column public.reservations.parking_type is
  'open_air (default), carport or garage. carport/garage require a garage_assignments row of the matching spot type; the type selects the price list row.';

-- Existing garage reservations assigned to a carport become carport reservations.
-- Runs before the cost trigger below starts reacting to parking_type changes,
-- so historical total_cost snapshots are left untouched.
update public.reservations r
set parking_type = 'carport'
from public.garage_assignments ga
join public.garage_spots gs on gs.id = ga.garage_spot_id
where ga.reservation_id = r.id
  and ga.superseded_at is null
  and gs.spot_type = 'carport'
  and r.parking_type = 'garage';

-- 2. Price lists
create table public.price_lists (
  id uuid primary key default gen_random_uuid(),
  valid_from date not null unique,
  valid_to date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_lists_valid_range check (valid_to is null or valid_to >= valid_from)
);

comment on table public.price_lists is
  'Price list validity periods; valid_to null = open-ended. Covering list with the latest valid_from wins.';

create table public.price_list_rates (
  price_list_id uuid not null references public.price_lists(id) on delete cascade,
  parking_type text not null check (parking_type in ('open_air', 'carport', 'garage')),
  day_prices numeric(10,2)[] not null,
  extra_day_price numeric(10,2) not null check (extra_day_price >= 0),
  primary key (price_list_id, parking_type),
  constraint price_list_rates_day_prices_valid check (
    cardinality(day_prices) = 14
    and array_position(day_prices, null) is null
    and 0 <= all (day_prices)
  )
);

comment on table public.price_list_rates is
  'Per parking type: day_prices[n] = total price for an n-day stay (n = 1..14); extra_day_price added per day beyond 14.';

create trigger handle_updated_at
  before update on public.price_lists
  for each row
  execute function public.handle_updated_at();

alter table public.price_lists enable row level security;
alter table public.price_list_rates enable row level security;

create policy "Staff manage price_lists"
  on public.price_lists for all
  to authenticated
  using (public.is_staff_role())
  with check (public.is_staff_role());

create policy "Staff manage price_list_rates"
  on public.price_list_rates for all
  to authenticated
  using (public.is_staff_role())
  with check (public.is_staff_role());

-- 3. Seed an open-ended base list from the current pricing_rules, so existing
--    prices carry over unchanged for all three parking types.
with base as (
  insert into public.price_lists (valid_from, valid_to)
  values (date '2000-01-01', null)
  returning id
),
old_prices as (
  select
    array(
      select public.calculate_total_cost(timestamptz '2000-01-01 00:00+00', timestamptz '2000-01-01 00:00+00' + make_interval(days => n))
      from generate_series(1, 14) as n
      order by n
    )::numeric(10,2)[] as day_prices,
    greatest(
      0,
      public.calculate_total_cost(timestamptz '2000-01-01 00:00+00', timestamptz '2000-01-16 00:00+00')
        - public.calculate_total_cost(timestamptz '2000-01-01 00:00+00', timestamptz '2000-01-15 00:00+00')
    )::numeric(10,2) as extra_day_price
)
insert into public.price_list_rates (price_list_id, parking_type, day_prices, extra_day_price)
select base.id, t.parking_type, old_prices.day_prices, old_prices.extra_day_price
from base, old_prices, (values ('open_air'), ('carport'), ('garage')) as t(parking_type);

-- 4. Cost calculation now reads the price list for the parking type.
drop function if exists public.calculate_total_cost(timestamptz, timestamptz);

create or replace function public.calculate_total_cost(
  p_check_in timestamptz,
  p_check_out timestamptz,
  p_parking_type text default 'open_air'
) returns numeric(10,2)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days integer;
  v_date date;
  v_rate record;
begin
  v_days := greatest(1, ceil(extract(epoch from (p_check_out - p_check_in)) / 86400)::integer);
  v_date := (p_check_in at time zone 'Europe/Warsaw')::date;

  select r.day_prices, r.extra_day_price
    into v_rate
    from public.price_lists pl
    join public.price_list_rates r
      on r.price_list_id = pl.id
     and r.parking_type = p_parking_type
    where pl.valid_from <= v_date
      and (pl.valid_to is null or pl.valid_to >= v_date)
    order by pl.valid_from desc
    limit 1;

  if not found then
    raise exception 'NO_PRICE_LIST: no price list for % on %', p_parking_type, v_date
      using errcode = 'P0001';
  end if;

  if v_days <= 14 then
    return v_rate.day_prices[v_days];
  end if;

  return v_rate.day_prices[14] + (v_days - 14) * v_rate.extra_day_price;
end;
$$;

comment on function public.calculate_total_cost(timestamptz, timestamptz, text) is
  'Total price for a stay: price list covering the check-in date (Europe/Warsaw, latest valid_from wins), row for p_parking_type. Raises NO_PRICE_LIST when none covers the date.';

-- Recalculate on date or parking type changes.
create or replace function public.update_reservation_cost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.planned_check_in is distinct from old.planned_check_in
     or new.planned_check_out is distinct from old.planned_check_out
     or new.parking_type is distinct from old.parking_type then
    new.total_cost := public.calculate_total_cost(new.planned_check_in, new.planned_check_out, new.parking_type);
  end if;
  return new;
end;
$$;

-- 5. Atomic create/update of a list with its rates (RLS applies: security invoker).
create or replace function public.save_price_list(
  p_id uuid,
  p_valid_from date,
  p_valid_to date,
  p_rates jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_rate jsonb;
begin
  if p_id is null then
    insert into public.price_lists (valid_from, valid_to)
    values (p_valid_from, p_valid_to)
    returning id into v_id;
  else
    update public.price_lists
    set valid_from = p_valid_from, valid_to = p_valid_to
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'PRICE_LIST_NOT_FOUND' using errcode = 'P0002';
    end if;

    delete from public.price_list_rates where price_list_id = v_id;
  end if;

  for v_rate in select value from jsonb_array_elements(p_rates) loop
    insert into public.price_list_rates (price_list_id, parking_type, day_prices, extra_day_price)
    values (
      v_id,
      v_rate ->> 'parking_type',
      array(
        select e.value::numeric(10,2)
        from jsonb_array_elements_text(v_rate -> 'day_prices') with ordinality as e(value, ord)
        order by e.ord
      ),
      (v_rate ->> 'extra_day_price')::numeric(10,2)
    );
  end loop;

  return v_id;
end;
$$;

comment on function public.save_price_list is
  'Creates (p_id null) or replaces a price list and all its rates in one transaction. p_rates: [{parking_type, day_prices[14], extra_day_price}].';

revoke execute on function public.save_price_list(uuid, date, date, jsonb) from public;
revoke execute on function public.save_price_list(uuid, date, date, jsonb) from anon;
grant execute on function public.save_price_list(uuid, date, date, jsonb) to authenticated;
grant execute on function public.save_price_list(uuid, date, date, jsonb) to service_role;

-- 6. Superseded pricing sources.
drop table if exists public.pricing_rules;
alter table public.garage_spots drop column if exists price_per_day;
delete from public.settings where key = 'daily_rate';
