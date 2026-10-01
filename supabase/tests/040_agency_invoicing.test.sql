-- Agency monthly invoicing: summary categories, issue guards, VAT totals, locks.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

select set_config('request.jwt.claims',
  json_build_object('sub', public.get_system_user(), 'app_metadata', json_build_object('role', 'staff'))::text, true);

-- Fixtures ------------------------------------------------------------------------
-- August 2026 (closed) and January 2099 (open) price lists: day_prices[n] = 10 * n.
with pl as (
  insert into public.price_lists (valid_from, valid_to)
  values (date '2026-08-01', date '2026-08-31'), (date '2099-01-01', null)
  returning id
)
insert into public.price_list_rates (price_list_id, parking_type, day_prices, extra_day_price)
select pl.id, t.parking_type,
       array(select (10 * n)::numeric(10,2) from generate_series(1, 14) as n order by n), 5
from pl, (values ('open_air'), ('carport'), ('garage')) as t(parking_type);

insert into public.travel_agencies (id, name, nip, address, email, discount_pct, payment_term_days) values
  ('00000000-0000-4000-8000-0000000000a1', 'Biuro Słońce', '1234563218', 'ul. Morska 1', 'b@s.pl', 0, 14),
  ('00000000-0000-4000-8000-0000000000a2', 'Biuro Puste', '5260250274', 'ul. Pusta 2', null, 0, 7);

insert into public.reservations (
  id, last_name, first_name, license_plate, planned_check_in, planned_check_out, actual_check_in,
  total_cost, source, status, parking_type, travel_agency_id, created_by, last_modified_by
)
select v.id::uuid, v.last_name, v.first_name, v.plate, v.cin::timestamptz, v.cout::timestamptz, v.act::timestamptz,
       0, 'phone', v.status::public.reservation_status, 'open_air',
       '00000000-0000-4000-8000-0000000000a1', public.get_system_user(), public.get_system_user()
from (values
  ('00000000-0000-4000-8000-0000000000e1', 'Arrived',  'Ann', 'WX 1', '2026-08-05 10:00+02', '2026-08-08 10:00+02', '2026-08-05 10:05+02', 'completed'),
  ('00000000-0000-4000-8000-0000000000e2', 'Parked',   null,  null,   '2026-08-10 10:00+02', '2026-08-11 10:00+02', '2026-08-10 10:05+02', 'in_progress'),
  ('00000000-0000-4000-8000-0000000000e3', 'Pending',  null,  null,   '2026-08-12 10:00+02', '2026-08-13 10:00+02', null,                  'confirmed'),
  ('00000000-0000-4000-8000-0000000000e4', 'Cancel',   null,  null,   '2026-08-20 10:00+02', '2026-08-21 10:00+02', null,                  'cancelled'),
  ('00000000-0000-4000-8000-0000000000e5', 'Boundary', null,  null,   '2026-08-31 23:30+02', '2026-09-02 23:30+02', '2026-08-31 23:35+02', 'in_progress'),
  ('00000000-0000-4000-8000-0000000000e6', 'NextMon',  null,  null,   '2026-09-01 00:30+02', '2026-09-02 00:30+02', null,                  'confirmed')
) as v(id, last_name, first_name, plate, cin, cout, act, status);

-- Summary --------------------------------------------------------------------------

select is(
  (select string_agg(last_name || ':' || category, ',' order by planned_check_in)
     from public.agency_month_summary('00000000-0000-4000-8000-0000000000a1', 2026, 8)),
  'Arrived:invoiceable,Parked:invoiceable,Pending:blocking,Cancel:excluded,Boundary:invoiceable',
  'August summary: categories by arrival/status; 31 Aug 23:30 Warsaw included, 1 Sep 00:30 Warsaw excluded'
);
select is(
  (select sum(gross_amount) from public.agency_month_summary('00000000-0000-4000-8000-0000000000a1', 2026, 8)
    where category = 'invoiceable'),
  60.00::numeric,
  'amount to invoice = 30.00 + 10.00 + 20.00 (still-parked arrivals included)'
);

-- Issue guards -----------------------------------------------------------------------

select throws_like(
  $$ select public.create_agency_invoice('00000000-0000-4000-8000-0000000000a1', 2026, 8) $$,
  'BLOCKING_RESERVATIONS%', 'a pending arrival blocks issuing'
);

update public.reservations set status = 'no_show' where id = '00000000-0000-4000-8000-0000000000e3';

select throws_like(
  $$ select public.create_agency_invoice('00000000-0000-4000-8000-0000000000a1', 2099, 1) $$,
  'MONTH_NOT_CLOSED%', 'an open month cannot be invoiced'
);
select throws_like(
  $$ select public.create_agency_invoice('00000000-0000-4000-8000-0000000000a2', 2026, 7) $$,
  'NOTHING_TO_INVOICE%', 'an empty month cannot be invoiced'
);

create temp table t_inv as
select public.create_agency_invoice('00000000-0000-4000-8000-0000000000a1', 2026, 8) as id;

-- Invoice content --------------------------------------------------------------------

select is(
  (select row(total_net, total_vat, total_amount, vat_rate)::text from public.invoices where id = (select id from t_inv)),
  row(48.78::numeric(10,2), 11.22::numeric(10,2), 60.00::numeric(10,2), 23.00::numeric(5,2))::text,
  'totals = sum of per-line splits: 24.39 + 8.13 + 16.26 net'
);
select is(
  (select string_agg(position || ':' || guest_name || ':' || gross_amount || ':' || net_amount, ',' order by position)
     from public.invoice_items where invoice_id = (select id from t_inv)),
  '1:Ann Arrived:30.00:24.39,2:Parked:10.00:8.13,3:Boundary:20.00:16.26',
  'one line per arrived reservation, ordered by planned check-in'
);
select is(
  (select row(billing_year, billing_month, sale_date, payment_due_date - issue_date, buyer_name, buyer_nip, buyer_email)::text
     from public.invoices where id = (select id from t_inv)),
  row(2026, 8, date '2026-08-31', 14, 'Biuro Słońce', '1234563218', 'b@s.pl')::text,
  'billing period, sale date = last day of month, due = issue + term, buyer snapshot'
);
select is(
  (select issue_date from public.invoices where id = (select id from t_inv)),
  (now() at time zone 'Europe/Warsaw')::date,
  'issue date = today (Warsaw)'
);
select matches(
  (select invoice_number from public.invoices where id = (select id from t_inv)),
  '^FV/' || to_char(now() at time zone 'Europe/Warsaw', 'YYYY/MM') || '/[0-9]{3}$',
  'number comes from the shared series of the issue month'
);
select throws_like(
  $$ select public.create_agency_invoice('00000000-0000-4000-8000-0000000000a1', 2026, 8) $$,
  'ALREADY_INVOICED%', 'the same agency-month cannot be invoiced twice'
);
select is(
  (select count(*) from public.agency_month_summary('00000000-0000-4000-8000-0000000000a1', 2026, 8)
    where category = 'invoiced' and invoice_id = (select id from t_inv)),
  3::bigint,
  'summary marks invoiced reservations with their invoice'
);

-- Locks ------------------------------------------------------------------------------

select throws_like(
  $$ update public.reservations set planned_check_out = '2026-08-09 10:00+02' where id = '00000000-0000-4000-8000-0000000000e1' $$,
  'RESERVATION_INVOICED%', 'invoiced: planned dates are locked'
);
select throws_like(
  $$ update public.reservations set travel_agency_id = null where id = '00000000-0000-4000-8000-0000000000e1' $$,
  'RESERVATION_INVOICED%', 'invoiced: agency is locked'
);
select throws_like(
  $$ update public.reservations set total_cost = 1 where id = '00000000-0000-4000-8000-0000000000e1' $$,
  'RESERVATION_INVOICED%', 'invoiced: price is locked'
);
select throws_like(
  $$ update public.reservations set status = 'cancelled' where id = '00000000-0000-4000-8000-0000000000e2' $$,
  'RESERVATION_INVOICED%', 'invoiced: cannot be cancelled'
);

update public.reservations
   set status = 'completed', actual_check_out = '2026-08-11 12:00+02', notes = 'odebrany', parking_sector = 'C3'
 where id = '00000000-0000-4000-8000-0000000000e2';
select is(
  (select row(status, notes, parking_sector)::text from public.reservations where id = '00000000-0000-4000-8000-0000000000e2'),
  row('completed'::public.reservation_status, 'odebrany', 'C3')::text,
  'invoiced: operational fields (departure, notes, sector) stay editable'
);

select set_config('request.jwt.claims',
  json_build_object('sub', public.get_system_user(), 'app_metadata', json_build_object('role', 'driver'))::text, true);
select throws_like(
  $$ update public.reservations set planned_check_out = '2026-09-03 23:30+02' where id = '00000000-0000-4000-8000-0000000000e5' $$,
  'RESERVATION_INVOICED%', 'the lock also applies to drivers (who cannot read invoices)'
);
select set_config('request.jwt.claims',
  json_build_object('sub', public.get_system_user(), 'app_metadata', json_build_object('role', 'staff'))::text, true);

select throws_like(
  $$ insert into public.reservations (last_name, planned_check_in, planned_check_out, total_cost, source,
       travel_agency_id, created_by, last_modified_by)
     values ('Late', '2026-08-15 10:00+02', '2026-08-16 10:00+02', 0, 'phone',
       '00000000-0000-4000-8000-0000000000a1', public.get_system_user(), public.get_system_user()) $$,
  'AGENCY_MONTH_INVOICED%', 'no new reservation can be added to an invoiced agency-month'
);
select throws_like(
  $$ update public.reservations set planned_check_in = '2026-08-30 10:00+02' where id = '00000000-0000-4000-8000-0000000000e6' $$,
  'AGENCY_MONTH_INVOICED%', 'no reservation can be moved into an invoiced agency-month'
);

-- Shared number series -------------------------------------------------------------------

insert into public.reservations (
  id, last_name, planned_check_in, planned_check_out, actual_check_in, actual_check_out, total_cost,
  source, status, parking_type, created_by, last_modified_by
) values (
  '00000000-0000-4000-8000-0000000000e7', 'Solo', '2026-08-05 10:00+02', '2026-08-06 10:00+02',
  '2026-08-05 10:00+02', '2026-08-06 10:00+02', 100, 'phone', 'completed', 'open_air',
  public.get_system_user(), public.get_system_user()
);
create temp table t_solo as
select public.create_invoice('00000000-0000-4000-8000-0000000000e7', 'Jan', '1234563218', 'x') as id;
select is(
  (select invoice_seq from public.invoices where id = (select id from t_solo)),
  (select invoice_seq + 1 from public.invoices where id = (select id from t_inv)),
  'individual and agency invoices share one number series'
);

-- RLS -----------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', public.get_system_user(), 'app_metadata', json_build_object('role', 'driver'))::text, true);
set local role authenticated;
select is(
  (select count(*) from public.agency_month_summary('00000000-0000-4000-8000-0000000000a1', 2026, 8)),
  0::bigint,
  'drivers get an empty summary (RLS)'
);
reset role;

select * from finish();
rollback;
