-- Travel agencies: constraints, staff-only RLS, delete blocked once referenced.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

insert into public.travel_agencies (id, name, nip, address, discount_pct, payment_term_days)
values ('00000000-0000-4000-8000-0000000000a1', 'Biuro Test', '1234563218', 'ul. Morska 1', 15, 14);

select throws_ok(
  $$ insert into public.travel_agencies (name, nip, address) values ('Dup', '1234563218', 'x') $$,
  '23505', null, 'NIP is unique'
);
select throws_ok(
  $$ insert into public.travel_agencies (name, nip, address) values ('Bad', '123-456-32-18', 'x') $$,
  '23514', null, 'NIP must be stored normalized (10 digits)'
);
select throws_ok(
  $$ insert into public.travel_agencies (name, nip, address, discount_pct) values ('Big', '5260250274', 'x', 101) $$,
  '23514', null, 'discount cannot exceed 100%'
);

-- RLS -------------------------------------------------------------------------

set local role authenticated;

select set_config('request.jwt.claims',
  json_build_object('sub', public.get_system_user(), 'app_metadata', json_build_object('role', 'driver'))::text, true);
select is((select count(*) from public.travel_agencies), 0::bigint, 'drivers cannot read travel agencies');
select throws_ok(
  $$ insert into public.travel_agencies (name, nip, address) values ('Drv', '5260250274', 'x') $$,
  '42501', null, 'drivers cannot create travel agencies'
);

select set_config('request.jwt.claims',
  json_build_object('sub', public.get_system_user(), 'app_metadata', json_build_object('role', 'staff'))::text, true);
select is(
  (select count(*) from public.travel_agencies where id = '00000000-0000-4000-8000-0000000000a1'),
  1::bigint,
  'staff can read travel agencies'
);

reset role;

-- Delete blocked once an invoice references the agency --------------------------

insert into public.invoices (invoice_number, invoice_year, invoice_month, invoice_seq, seller_name, seller_address,
  seller_nip, seller_bank_account, buyer_name, buyer_nip, buyer_address, total_amount, created_by, travel_agency_id)
values ('FV/2099/01/901', 2099, 1, 901, 's', 'a', 'n', 'b', 'Biuro Test', '1234563218', 'x', 0,
  public.get_system_user(), '00000000-0000-4000-8000-0000000000a1');

select throws_ok(
  $$ delete from public.travel_agencies where id = '00000000-0000-4000-8000-0000000000a1' $$,
  '23503', null, 'an invoiced agency cannot be deleted'
);

update public.travel_agencies set archived_at = now() where id = '00000000-0000-4000-8000-0000000000a1';
select isnt(
  (select archived_at from public.travel_agencies where id = '00000000-0000-4000-8000-0000000000a1'),
  null,
  'an invoiced agency can be archived'
);

select * from finish();
rollback;
