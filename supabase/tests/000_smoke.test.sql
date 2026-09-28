-- Smoke tests: pin existing money rules before the travel-agencies change touches them.
-- Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

-- Fixture: a far-future price list so the base 2000-01-01 list never wins.
-- day_prices[n] = 10 * n, extra_day_price = 5.
with pl as (
  insert into public.price_lists (valid_from, valid_to)
  values (date '2099-01-01', null)
  returning id
)
insert into public.price_list_rates (price_list_id, parking_type, day_prices, extra_day_price)
select pl.id, t.parking_type,
       array(select (10 * n)::numeric(10,2) from generate_series(1, 14) as n order by n),
       5
from pl, (values ('open_air'), ('carport'), ('garage')) as t(parking_type);

-- calculate_total_cost ------------------------------------------------------

select is(
  public.calculate_total_cost(timestamptz '2099-06-01 10:00+02', timestamptz '2099-06-04 10:00+02', 'open_air'),
  30.00::numeric(10,2),
  '3-day stay costs day_prices[3]'
);

select is(
  public.calculate_total_cost(timestamptz '2099-06-01 10:00+02', timestamptz '2099-06-01 12:00+02', 'open_air'),
  10.00::numeric(10,2),
  'a stay shorter than 24h is billed as 1 day'
);

select is(
  public.calculate_total_cost(timestamptz '2099-06-01 10:00+02', timestamptz '2099-06-21 10:00+02', 'garage'),
  170.00::numeric(10,2),
  '20-day stay costs day_prices[14] + 6 * extra_day_price'
);

select throws_like(
  $$ select public.calculate_total_cost(timestamptz '1999-06-01 10:00+02', timestamptz '1999-06-03 10:00+02', 'open_air') $$,
  'NO_PRICE_LIST%',
  'no covering price list raises NO_PRICE_LIST'
);

-- trg_update_cost -------------------------------------------------------------

insert into public.reservations (
  id, last_name, planned_check_in, planned_check_out, total_cost, source, status,
  parking_type, created_by, last_modified_by
) values (
  '00000000-0000-4000-8000-000000000001', 'Smoke', '2099-06-01 10:00+02', '2099-06-04 10:00+02', 30,
  'phone', 'confirmed', 'open_air', public.get_system_user(), public.get_system_user()
);

update public.reservations
   set planned_check_out = '2099-06-06 10:00+02'
 where id = '00000000-0000-4000-8000-000000000001';

select is(
  (select total_cost from public.reservations where id = '00000000-0000-4000-8000-000000000001'),
  50.00::numeric(10,2),
  'changing planned_check_out reprices the reservation'
);

update public.reservations
   set total_cost = 999, notes = 'staff override'
 where id = '00000000-0000-4000-8000-000000000001';

select is(
  (select total_cost from public.reservations where id = '00000000-0000-4000-8000-000000000001'),
  999.00::numeric(10,2),
  'staff can override total_cost when dates and type are unchanged'
);

-- Driver allowlist trigger -----------------------------------------------------

select set_config(
  'request.jwt.claims',
  json_build_object('sub', public.get_system_user(), 'app_metadata', json_build_object('role', 'driver'))::text,
  true
);

update public.reservations
   set total_cost = 1, parking_sector = 'A1'
 where id = '00000000-0000-4000-8000-000000000001';

select is(
  (select total_cost from public.reservations where id = '00000000-0000-4000-8000-000000000001'),
  999.00::numeric(10,2),
  'driver-supplied total_cost is ignored'
);

select throws_ok(
  $$ update public.reservations set planned_check_in = '2099-06-02 10:00+02'
      where id = '00000000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'driver cannot change planned_check_in'
);

select throws_ok(
  $$ update public.reservations set status = 'cancelled'
      where id = '00000000-0000-4000-8000-000000000001' $$,
  '42501',
  null,
  'driver cannot cancel a confirmed reservation'
);

select * from finish();
rollback;
