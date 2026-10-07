-- Driver operations under RLS (role authenticated + driver JWT): completing a departure and
-- entering a license plate at arrival must work end to end, including UPDATE … RETURNING.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(6);

with pl as (
  insert into public.price_lists (valid_from, valid_to) values (date '2099-01-01', null) returning id
)
insert into public.price_list_rates (price_list_id, parking_type, day_prices, extra_day_price)
select pl.id, t.parking_type,
       array(select (10 * n)::numeric(10,2) from generate_series(1, 14) as n order by n), 5
from pl, (values ('open_air'), ('carport'), ('garage')) as t(parking_type);

insert into public.reservations (
  id, last_name, planned_check_in, planned_check_out, total_cost, source, status, actual_check_in,
  created_by, last_modified_by
) values
  ('00000000-0000-4000-8000-0000000000e1', 'Wyjazd', '2099-06-01 10:00+02', '2099-06-04 10:00+02', 30,
   'phone', 'in_progress', now() - interval '1 hour', public.get_system_user(), public.get_system_user()),
  ('00000000-0000-4000-8000-0000000000e2', 'Przyjazd', '2099-06-01 10:00+02', '2099-06-04 10:00+02', 30,
   'phone', 'confirmed', null, public.get_system_user(), public.get_system_user()),
  ('00000000-0000-4000-8000-0000000000e4', 'Na parkingu', '2099-06-01 10:00+02', '2099-06-04 10:00+02', 30,
   'phone', 'in_progress', now() - interval '1 hour', public.get_system_user(), public.get_system_user()),
  ('00000000-0000-4000-8000-0000000000e3', 'Stary', '2099-05-01 10:00+02', '2099-05-04 10:00+02', 30,
   'phone', 'completed', now() - interval '11 days', public.get_system_user(), public.get_system_user());
update public.reservations set actual_check_out = now() - interval '10 days'
 where id = '00000000-0000-4000-8000-0000000000e3';

select set_config(
  'request.jwt.claims',
  json_build_object('sub', public.get_system_user(), 'app_metadata', json_build_object('role', 'driver'))::text,
  true
);
set local role authenticated;

select lives_ok(
  $$ update public.reservations
        set status = 'completed', actual_check_out = now(), paid_at_departure = true, is_paid = true
      where id = '00000000-0000-4000-8000-0000000000e1'
  returning id $$,
  'driver can complete a departure (UPDATE … RETURNING, as PostgREST does)'
);

select is(
  (select status::text from public.reservations where id = '00000000-0000-4000-8000-0000000000e1'),
  'completed',
  'driver still sees the just-completed departure (handled list)'
);

select is(
  (select count(*) from public.reservations where id = '00000000-0000-4000-8000-0000000000e3'),
  0::bigint,
  'drivers do not see old completed stays'
);

select lives_ok(
  $$ update public.reservations
        set status = 'in_progress', actual_check_in = now(), license_plate = 'KR 12345'
      where id = '00000000-0000-4000-8000-0000000000e2'
  returning id $$,
  'driver can enter a license plate when confirming arrival'
);

select throws_ok(
  $$ update public.reservations set license_plate = 'XX 1'
      where id = '00000000-0000-4000-8000-0000000000e4' $$,
  '42501',
  null,
  'driver cannot change the plate outside arrival (car already on the lot)'
);

select throws_ok(
  $$ update public.reservations set last_name = 'Inny'
      where id = '00000000-0000-4000-8000-0000000000e2' $$,
  '42501',
  null,
  'identity columns stay frozen for drivers'
);

select * from finish();
rollback;
