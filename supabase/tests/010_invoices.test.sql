-- Invoices: items model, VAT split, create_invoice guards, Warsaw-month numbering.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

-- Schema --------------------------------------------------------------------

select has_table('public', 'invoice_items', 'invoice_items exists');
select hasnt_column('public', 'invoices', 'reservation_id', 'invoices.reservation_id moved to items');
select col_is_unique('public', 'invoice_items', 'reservation_id', 'a reservation is invoiced at most once');
select is(public.setting_text('vat_rate'), '23', 'vat_rate setting defaults to 23');

-- VAT split -----------------------------------------------------------------

select is(public.vat_net_from_gross(123.00, 23), 100.00::numeric(10,2), 'gross 123.00 @23% -> net 100.00');
select is(public.vat_net_from_gross(100.00, 23), 81.30::numeric(10,2), 'gross 100.00 @23% -> net 81.30');

-- Numbering (Europe/Warsaw) ---------------------------------------------------

select is(
  (select invoice_month from public.next_invoice_number(timestamptz '2026-09-30 21:30:00+00')),
  9,
  '23:30 Warsaw on 30 Sep belongs to September'
);
select is(
  (select invoice_month from public.next_invoice_number(timestamptz '2026-09-30 22:30:00+00')),
  10,
  '00:30 Warsaw on 1 Oct belongs to October (UTC still says September)'
);
select is(
  (select invoice_number from public.next_invoice_number(timestamptz '2099-03-15 12:00:00+00')),
  'FV/2099/03/001',
  'first number of an empty month is 001, zero-padded'
);

-- Fixtures: staff session + reservations ---------------------------------------

select set_config(
  'request.jwt.claims',
  json_build_object('sub', public.get_system_user(), 'app_metadata', json_build_object('role', 'staff'))::text,
  true
);

insert into public.reservations (
  id, last_name, first_name, license_plate, planned_check_in, planned_check_out,
  actual_check_in, actual_check_out, total_cost, source, status, parking_type, created_by, last_modified_by
) values
  ('00000000-0000-4000-8000-0000000000c1', 'Nowak', 'Anna', 'WX 1', '2026-09-01 10:00+02', '2026-09-04 10:00+02',
   '2026-09-01 10:05+02', '2026-09-04 23:30+02', 123.00, 'phone', 'completed', 'open_air',
   public.get_system_user(), public.get_system_user()),
  ('00000000-0000-4000-8000-0000000000c2', 'Kowal', null, null, '2026-09-10 10:00+02', '2026-09-11 10:00+02',
   null, null, 100.00, 'phone', 'completed', 'garage', public.get_system_user(), public.get_system_user()),
  ('00000000-0000-4000-8000-0000000000c3', 'Pending', null, null, '2026-09-10 10:00+02', '2026-09-11 10:00+02',
   null, null, 50.00, 'phone', 'confirmed', 'open_air', public.get_system_user(), public.get_system_user());

create temp table t_inv as
select public.create_invoice('00000000-0000-4000-8000-0000000000c1', 'Buyer A', '1234563218', 'Addr A', '') as id1;

-- create_invoice: header + line --------------------------------------------------

select is(
  (select row(total_net, total_vat, total_amount, vat_rate)::text from public.invoices where id = (select id1 from t_inv)),
  row(100.00::numeric(10,2), 23.00::numeric(10,2), 123.00::numeric(10,2), 23.00::numeric(5,2))::text,
  'invoice totals: net 100.00, VAT 23.00, gross 123.00 at 23%'
);
select is(
  (select row(position, guest_name, license_plate, days_count, net_amount, vat_amount, gross_amount)::text
     from public.invoice_items where invoice_id = (select id1 from t_inv)),
  row(1, 'Anna Nowak', 'WX 1', 4, 100.00::numeric(10,2), 23.00::numeric(10,2), 123.00::numeric(10,2))::text,
  'one line snapshotting guest, plate, actual days and VAT split'
);
select is(
  (select sale_date from public.invoices where id = (select id1 from t_inv)),
  date '2026-09-04',
  'sale date = actual check-out date in Warsaw'
);
select is(
  (select issue_date from public.invoices where id = (select id1 from t_inv)),
  (now() at time zone 'Europe/Warsaw')::date,
  'issue date = today in Warsaw'
);
select is(
  (select buyer_email from public.invoices where id = (select id1 from t_inv)),
  null,
  'empty buyer email stored as null'
);
select is(
  (select created_by from public.invoices where id = (select id1 from t_inv)),
  public.get_system_user(),
  'created_by = auth.uid()'
);

insert into t_inv (id1)
select public.create_invoice('00000000-0000-4000-8000-0000000000c2', 'Buyer B', '1234563218', 'Addr B');

select is(
  (select array_agg(i.invoice_seq order by i.invoice_seq) from public.invoices i where i.id in (select id1 from t_inv)),
  (select array[min(i.invoice_seq), min(i.invoice_seq) + 1] from public.invoices i where i.id in (select id1 from t_inv)),
  'consecutive invoices get consecutive sequence numbers'
);
select is(
  (select row(total_net, total_vat)::text from public.invoices i
     join public.invoice_items it on it.invoice_id = i.id
    where it.reservation_id = '00000000-0000-4000-8000-0000000000c2'),
  row(81.30::numeric(10,2), 18.70::numeric(10,2))::text,
  'gross 100.00 splits into 81.30 + 18.70'
);

-- Guards --------------------------------------------------------------------------

select throws_like(
  $$ select public.create_invoice('00000000-0000-4000-8000-0000000000c1', 'X', '1', 'Y') $$,
  'DUPLICATE_INVOICE%',
  'second invoice for the same reservation is rejected'
);
select throws_like(
  $$ select public.create_invoice('00000000-0000-4000-8000-0000000000c3', 'X', '1', 'Y') $$,
  'RESERVATION_NOT_COMPLETED%',
  'non-completed reservation cannot be invoiced'
);
select throws_like(
  $$ select public.create_invoice('00000000-0000-4000-8000-00000000dead', 'X', '1', 'Y') $$,
  'RESERVATION_NOT_FOUND%',
  'unknown reservation is rejected'
);
select throws_ok(
  $$ insert into public.invoices (invoice_number, invoice_year, invoice_month, invoice_seq, seller_name, seller_address,
       seller_nip, seller_bank_account, buyer_name, buyer_nip, buyer_address, total_amount, created_by)
     select 'FV/DUP', invoice_year, invoice_month, invoice_seq, 's', 'a', 'n', 'b', 'x', 'y', 'z', 1, created_by
       from public.invoices where id = (select min(id1::text)::uuid from t_inv) $$,
  '23505',
  null,
  'UNIQUE (invoice_year, invoice_month, invoice_seq) backstops the allocator'
);

-- RLS: drivers see no invoice lines --------------------------------------------------

select set_config(
  'request.jwt.claims',
  json_build_object('sub', public.get_system_user(), 'app_metadata', json_build_object('role', 'driver'))::text,
  true
);
set local role authenticated;
select is((select count(*) from public.invoice_items), 0::bigint, 'drivers cannot read invoice_items');
reset role;

select * from finish();
rollback;
