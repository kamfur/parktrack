-- Agency reservations: discounted price and paid-by-agency survive every write path.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(18);

-- Fixtures: price list day_prices[n] = 10 * n (from 2099), agency with 15% discount.
with pl as (
  insert into public.price_lists (valid_from, valid_to) values (date '2099-01-01', null) returning id
)
insert into public.price_list_rates (price_list_id, parking_type, day_prices, extra_day_price)
select pl.id, t.parking_type,
       array(select (10 * n)::numeric(10,2) from generate_series(1, 14) as n order by n), 5
from pl, (values ('open_air'), ('carport'), ('garage')) as t(parking_type);

insert into public.travel_agencies (id, name, nip, address, discount_pct)
values
  ('00000000-0000-4000-8000-0000000000a1', 'Biuro 15', '1234563218', 'x', 15),
  ('00000000-0000-4000-8000-0000000000a2', 'Biuro archiwum', '5260250274', 'x', 50);
update public.travel_agencies set archived_at = now() where id = '00000000-0000-4000-8000-0000000000a2';

-- Insert with agency; client sends a bogus total and paid flags.
insert into public.reservations (
  id, last_name, planned_check_in, planned_check_out, total_cost, source, status, parking_type,
  travel_agency_id, agency_discount_pct, is_paid, paid_at_arrival, surcharge_amount, created_by, last_modified_by
) values (
  '00000000-0000-4000-8000-0000000000d1', 'Agencyjny', '2099-06-01 10:00+02', '2099-06-04 10:00+02', 999,
  'phone', 'confirmed', 'open_air', '00000000-0000-4000-8000-0000000000a1', 99, false, true, 40,
  public.get_system_user(), public.get_system_user()
);

select is((select total_cost from public.reservations where id = '00000000-0000-4000-8000-0000000000d1'),
  25.50::numeric(10,2), 'insert with agency: 3 days = 30.00 − 15% = 25.50 (client total ignored)');
select is((select agency_discount_pct from public.reservations where id = '00000000-0000-4000-8000-0000000000d1'),
  15.00::numeric(5,2), 'discount snapshotted from the agency (client value ignored)');
select is(
  (select row(is_paid, paid_at_arrival, paid_at_departure, surcharge_amount)::text
     from public.reservations where id = '00000000-0000-4000-8000-0000000000d1'),
  row(true, false, false, null::numeric)::text,
  'agency reservation is paid; driver payment flags and surcharge cleared'
);

-- Staff edits
update public.reservations set planned_check_out = '2099-06-06 10:00+02'
 where id = '00000000-0000-4000-8000-0000000000d1';
select is((select total_cost from public.reservations where id = '00000000-0000-4000-8000-0000000000d1'),
  42.50::numeric(10,2), 'staff date edit reprices with the discount: 5 days = 50.00 − 15% = 42.50');

update public.reservations set total_cost = 1, notes = 'x' where id = '00000000-0000-4000-8000-0000000000d1';
select is((select total_cost from public.reservations where id = '00000000-0000-4000-8000-0000000000d1'),
  42.50::numeric(10,2), 'client total_cost on an agency reservation is ignored');

update public.travel_agencies set discount_pct = 50 where id = '00000000-0000-4000-8000-0000000000a1';
update public.reservations set parking_sector = 'B2' where id = '00000000-0000-4000-8000-0000000000d1';
select is((select total_cost from public.reservations where id = '00000000-0000-4000-8000-0000000000d1'),
  42.50::numeric(10,2), 'changing the agency discount does not touch existing reservations');
update public.reservations set planned_check_out = '2099-06-05 10:00+02'
 where id = '00000000-0000-4000-8000-0000000000d1';
select is((select total_cost from public.reservations where id = '00000000-0000-4000-8000-0000000000d1'),
  34.00::numeric(10,2), 'later date edits keep the original 15% snapshot: 4 days = 40.00 − 15% = 34.00');

-- Driver path
select set_config('request.jwt.claims',
  json_build_object('sub', public.get_system_user(), 'app_metadata', json_build_object('role', 'driver'))::text, true);

update public.reservations
   set status = 'in_progress', actual_check_in = '2099-06-01 10:05+02',
       paid_at_arrival = false, is_paid = false
 where id = '00000000-0000-4000-8000-0000000000d1';
select is((select is_paid from public.reservations where id = '00000000-0000-4000-8000-0000000000d1'),
  true, 'driver arrival with unpaid flags keeps the agency reservation paid');

update public.reservations set planned_check_out = '2099-06-06 10:00+02'
 where id = '00000000-0000-4000-8000-0000000000d1';
select is((select total_cost from public.reservations where id = '00000000-0000-4000-8000-0000000000d1'),
  42.50::numeric(10,2), 'driver planned_check_out change reprices with the discount');

select throws_ok(
  $$ update public.reservations set travel_agency_id = null where id = '00000000-0000-4000-8000-0000000000d1' $$,
  '42501', null, 'driver cannot remove the agency'
);
select throws_ok(
  $$ update public.reservations set agency_discount_pct = 90 where id = '00000000-0000-4000-8000-0000000000d1' $$,
  '42501', null, 'driver cannot change the discount snapshot'
);

select set_config('request.jwt.claims',
  json_build_object('sub', public.get_system_user(), 'app_metadata', json_build_object('role', 'staff'))::text, true);

-- Removing the agency restores the full price and a driver-derived paid flag.
update public.reservations set travel_agency_id = null where id = '00000000-0000-4000-8000-0000000000d1';
select is(
  (select row(total_cost, agency_discount_pct, is_paid)::text
     from public.reservations where id = '00000000-0000-4000-8000-0000000000d1'),
  row(50.00::numeric(10,2), null::numeric, false)::text,
  'removing the agency: full price 50.00, no snapshot, unpaid (no driver payment recorded)'
);

-- Re-assigning snapshots the agency's current discount (now 50%).
update public.reservations set travel_agency_id = '00000000-0000-4000-8000-0000000000a1'
 where id = '00000000-0000-4000-8000-0000000000d1';
select is(
  (select row(total_cost, agency_discount_pct, is_paid)::text
     from public.reservations where id = '00000000-0000-4000-8000-0000000000d1'),
  row(25.00::numeric(10,2), 50.00::numeric(5,2), true)::text,
  're-assigning snapshots the current 50% discount: 50.00 → 25.00, paid'
);

-- Archived agency
select throws_like(
  $$ update public.reservations set travel_agency_id = '00000000-0000-4000-8000-0000000000a2'
      where id = '00000000-0000-4000-8000-0000000000d1' $$,
  'AGENCY_ARCHIVED%', 'an archived agency cannot be newly assigned'
);
update public.travel_agencies set archived_at = now() where id = '00000000-0000-4000-8000-0000000000a1';
update public.reservations set notes = 'still ok' where id = '00000000-0000-4000-8000-0000000000d1';
select is((select notes from public.reservations where id = '00000000-0000-4000-8000-0000000000d1'),
  'still ok', 'archiving an agency keeps existing assignments editable');

-- Individual reservations keep the old behaviour.
insert into public.reservations (
  id, last_name, planned_check_in, planned_check_out, total_cost, source, status, parking_type,
  paid_at_arrival, is_paid, created_by, last_modified_by
) values (
  '00000000-0000-4000-8000-0000000000d2', 'Indywidualny', '2099-06-01 10:00+02', '2099-06-04 10:00+02', 77,
  'phone', 'confirmed', 'open_air', true, true, public.get_system_user(), public.get_system_user()
);
select is(
  (select row(total_cost, is_paid, agency_discount_pct)::text
     from public.reservations where id = '00000000-0000-4000-8000-0000000000d2'),
  row(77.00::numeric(10,2), true, null::numeric)::text,
  'individual insert keeps the provided total and paid flag'
);
select throws_ok(
  $$ insert into public.reservations (last_name, planned_check_in, planned_check_out, total_cost, source,
       travel_agency_id, created_by, last_modified_by)
     values ('X', '2099-06-01 10:00+02', '2099-06-02 10:00+02', 1, 'phone',
       '00000000-0000-4000-8000-00000000dead', public.get_system_user(), public.get_system_user()) $$,
  'P0001', null, 'an unknown agency is rejected'
);

-- Individual invoice for an agency reservation is refused.
update public.reservations set status = 'completed', actual_check_out = '2099-06-06 09:00+02'
 where id = '00000000-0000-4000-8000-0000000000d1';
select throws_like(
  $$ select public.create_invoice('00000000-0000-4000-8000-0000000000d1', 'X', '1', 'Y') $$,
  'RESERVATION_BILLED_TO_AGENCY%', 'agency reservations cannot get an individual invoice'
);

select * from finish();
rollback;
