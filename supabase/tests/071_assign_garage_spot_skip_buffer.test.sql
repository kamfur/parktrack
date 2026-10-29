-- assign_garage_spot: the 10h buffer is enforced by default and skipped with p_skip_buffer.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(3);

insert into public.garage_spots (id, name, spot_type, capacity_label)
values ('00000000-0000-4000-8000-0000000000c1', 'Test-G1', 'garage', 'single');

insert into public.reservations (
  id, last_name, planned_check_in, planned_check_out, total_cost, source, status, parking_type,
  created_by, last_modified_by
) values
  ('00000000-0000-4000-8000-0000000000d1', 'Pierwszy', '2099-06-01 10:00+02', '2099-06-04 10:00+02', 10,
   'phone', 'confirmed', 'garage', public.get_system_user(), public.get_system_user()),
  ('00000000-0000-4000-8000-0000000000d2', 'Drugi', '2099-06-04 12:00+02', '2099-06-06 10:00+02', 10,
   'phone', 'confirmed', 'garage', public.get_system_user(), public.get_system_user());

select public.assign_garage_spot(
  '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000c1', 'staff');

select throws_ok(
  $$select public.assign_garage_spot(
      '00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000c1', 'staff')$$,
  'P0001', 'GARAGE_BUFFER_VIOLATION', 'conflicting window is rejected by default');

select lives_ok(
  $$select public.assign_garage_spot(
      '00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000c1', 'staff', true)$$,
  'p_skip_buffer = true assigns despite the conflict');

select is(
  (select count(*)::int from public.garage_assignments
    where garage_spot_id = '00000000-0000-4000-8000-0000000000c1' and superseded_at is null),
  2, 'both reservations hold the spot');

select * from finish();
rollback;
