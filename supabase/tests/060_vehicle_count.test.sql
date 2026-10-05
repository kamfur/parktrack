-- Reservations for several cars: price = price list amount x vehicle_count (before the agency discount).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

-- Fixtures: price list day_prices[n] = 10 * n (from 2099), agency with 10% discount.
with pl as (
  insert into public.price_lists (valid_from, valid_to) values (date '2099-01-01', null) returning id
)
insert into public.price_list_rates (price_list_id, parking_type, day_prices, extra_day_price)
select pl.id, t.parking_type,
       array(select (10 * n)::numeric(10,2) from generate_series(1, 14) as n order by n), 5
from pl, (values ('open_air'), ('carport'), ('garage')) as t(parking_type);

insert into public.travel_agencies (id, name, nip, address, discount_pct)
values ('00000000-0000-4000-8000-0000000000b1', 'Biuro 10', '1234563218', 'x', 10);

-- Individual client: the first price is set by the service; arrival reprices an unpaid stay.
insert into public.reservations (
  id, last_name, planned_check_in, planned_check_out, total_cost, source, status, parking_type,
  vehicle_count, extra_license_plates, created_by, last_modified_by
) values (
  '00000000-0000-4000-8000-0000000000e1', 'Wieloauto', '2099-06-01 10:00+02', '2099-06-04 10:00+02', 90,
  'phone', 'confirmed', 'open_air', 3, array['KR 2', 'PO 3'], public.get_system_user(), public.get_system_user()
);

select is((select vehicle_count from public.reservations where id = '00000000-0000-4000-8000-0000000000e1'),
  3, 'vehicle_count is stored');

update public.reservations set planned_check_out = '2099-06-05 10:00+02'
 where id = '00000000-0000-4000-8000-0000000000e1';
select is((select total_cost from public.reservations where id = '00000000-0000-4000-8000-0000000000e1'),
  120.00::numeric(10,2), 'date edit reprices: 4 days = 40.00 x 3 cars = 120.00');

update public.reservations set vehicle_count = 2, extra_license_plates = array['KR 2']
 where id = '00000000-0000-4000-8000-0000000000e1';
select is((select total_cost from public.reservations where id = '00000000-0000-4000-8000-0000000000e1'),
  80.00::numeric(10,2), 'changing the car count reprices: 40.00 x 2 = 80.00');

update public.reservations set notes = 'x' where id = '00000000-0000-4000-8000-0000000000e1';
select is((select total_cost from public.reservations where id = '00000000-0000-4000-8000-0000000000e1'),
  80.00::numeric(10,2), 'unrelated edits keep the price');

-- Agency: multiplied first, then discounted.
insert into public.reservations (
  id, last_name, planned_check_in, planned_check_out, total_cost, source, status, parking_type,
  travel_agency_id, vehicle_count, created_by, last_modified_by
) values (
  '00000000-0000-4000-8000-0000000000e2', 'Agencja', '2099-06-01 10:00+02', '2099-06-04 10:00+02', 1,
  'phone', 'confirmed', 'open_air', '00000000-0000-4000-8000-0000000000b1', 2,
  public.get_system_user(), public.get_system_user()
);
select is((select total_cost from public.reservations where id = '00000000-0000-4000-8000-0000000000e2'),
  54.00::numeric(10,2), 'agency: 30.00 x 2 cars − 10% = 54.00');

-- Constraints
select throws_ok(
  $$update public.reservations set vehicle_count = 0 where id = '00000000-0000-4000-8000-0000000000e1'$$,
  '23514', null, 'vehicle_count below 1 is rejected');
select throws_ok(
  $$update public.reservations set vehicle_count = 11 where id = '00000000-0000-4000-8000-0000000000e1'$$,
  '23514', null, 'vehicle_count above 10 is rejected');
select throws_ok(
  $$update public.reservations set extra_license_plates = array['A', 'B'] where id = '00000000-0000-4000-8000-0000000000e1'$$,
  '23514', null, 'more extra plates than cars − 1 is rejected');

-- Driver: may change the count and plates while confirming the arrival, not afterwards.
select set_config('request.jwt.claims',
  json_build_object('sub', public.get_system_user(), 'app_metadata', json_build_object('role', 'driver'))::text, true);
set local role authenticated;

update public.reservations
   set status = 'in_progress', actual_check_in = '2099-06-01 10:05+02', vehicle_count = 3,
       extra_license_plates = array['KR 2', 'PO 3']
 where id = '00000000-0000-4000-8000-0000000000e1';
select throws_ok(
  $$update public.reservations set vehicle_count = 1, extra_license_plates = '{}'
     where id = '00000000-0000-4000-8000-0000000000e1'$$,
  '42501', null, 'driver cannot change the car count after the arrival');

select * from finish();
rollback;
