-- Migration: invoice items, VAT breakdown, atomic Europe/Warsaw numbering
-- Affected: invoices (altered), invoice_items (new), settings (vat_rate key)
-- Intent: an invoice can carry many reservation lines (travel-agency monthly
--         invoices), each with net / VAT / gross. Invoices issued before this
--         migration become "legacy" (vat_rate is null) and keep their original
--         gross-only content. Numbers FV/YYYY/MM/NNN are allocated under an
--         advisory lock in Warsaw time (fixes the server-local month + MAX+1 race).

-- ---------------------------------------------------------------------------
-- 1. Invoice header: VAT, dates, agency link (FK added with travel_agencies)
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column travel_agency_id uuid null,
  add column billing_year integer null,
  add column billing_month integer null check (billing_month between 1 and 12),
  add column issue_date date null,
  add column sale_date date null,
  add column payment_due_date date null,
  add column vat_rate numeric(5,2) null check (vat_rate >= 0 and vat_rate <= 100),
  add column total_net numeric(10,2) null,
  add column total_vat numeric(10,2) null;

update public.invoices
   set issue_date = (coalesce(created_at, now()) at time zone 'Europe/Warsaw')::date;

alter table public.invoices
  alter column issue_date set not null,
  alter column issue_date set default ((now() at time zone 'Europe/Warsaw')::date);

comment on column public.invoices.total_amount is 'Gross total (sum of invoice_items.gross_amount).';
comment on column public.invoices.vat_rate is 'VAT rate snapshot in %. NULL = legacy invoice issued before VAT breakdown (gross only).';
comment on column public.invoices.sale_date is 'Date of sale / service completion; for agency invoices the last day of the billing month.';

alter table public.invoices
  add constraint invoices_year_month_seq_key unique (invoice_year, invoice_month, invoice_seq);

-- ---------------------------------------------------------------------------
-- 2. Invoice items (one reservation is invoiced at most once)
-- ---------------------------------------------------------------------------
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position integer not null check (position >= 1),
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  guest_name text not null,
  license_plate text null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  parking_type text not null,
  days_count integer not null check (days_count >= 1),
  description text not null,
  net_amount numeric(10,2) null,
  vat_amount numeric(10,2) null,
  gross_amount numeric(10,2) not null,
  constraint invoice_items_reservation_key unique (reservation_id),
  constraint invoice_items_position_key unique (invoice_id, position)
);

comment on table public.invoice_items is
  'Invoice lines; snapshot of the reservation at issue time. net/vat NULL on legacy invoices.';

alter table public.invoice_items enable row level security;

create policy "Staff full access to invoice_items"
  on public.invoice_items for all
  to authenticated
  using (public.is_staff_role())
  with check (public.is_staff_role());

-- Backfill: one line per existing invoice, from its reservation.
insert into public.invoice_items (
  invoice_id, position, reservation_id, guest_name, license_plate,
  period_start, period_end, parking_type, days_count, description, gross_amount
)
select
  i.id, 1, i.reservation_id,
  concat_ws(' ', r.first_name, r.last_name), r.license_plate,
  r.planned_check_in, r.planned_check_out, r.parking_type,
  i.days_count, 'Usługa parkingowa', i.total_amount
from public.invoices i
join public.reservations r on r.id = i.reservation_id;

alter table public.invoices
  drop column reservation_id,
  drop column days_count,
  drop column daily_rate_snapshot;

-- ---------------------------------------------------------------------------
-- 3. VAT rate setting
-- ---------------------------------------------------------------------------
insert into public.settings (key, value, description, updated_by)
values ('vat_rate', '23', 'Stawka VAT (%) na fakturach', get_system_user())
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Number allocator (call inside the inserting transaction)
-- ---------------------------------------------------------------------------
create or replace function public.next_invoice_number(p_at timestamptz default now())
returns table (invoice_year integer, invoice_month integer, invoice_seq integer, invoice_number text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_local timestamp := p_at at time zone 'Europe/Warsaw';
  v_year integer := extract(year from v_local)::integer;
  v_month integer := extract(month from v_local)::integer;
  v_seq integer;
begin
  -- Serialises allocation per Warsaw month until the caller's transaction ends.
  perform pg_advisory_xact_lock(hashtext('public.invoices.invoice_seq'), v_year * 100 + v_month);

  select coalesce(max(i.invoice_seq), 0) + 1
    into v_seq
    from public.invoices i
   where i.invoice_year = v_year and i.invoice_month = v_month;

  return query select
    v_year, v_month, v_seq,
    format('FV/%s/%s/%s', v_year, lpad(v_month::text, 2, '0'), lpad(v_seq::text, 3, '0'));
end;
$$;

comment on function public.next_invoice_number(timestamptz) is
  'Next FV/YYYY/MM/NNN in the Europe/Warsaw month of p_at; holds a per-month advisory lock for the transaction.';

-- ---------------------------------------------------------------------------
-- 5. Setting readers + VAT split helpers
-- ---------------------------------------------------------------------------
create or replace function public.setting_text(p_key text)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce((select s.value #>> '{}' from public.settings s where s.key = p_key), '');
$$;

create or replace function public.vat_net_from_gross(p_gross numeric, p_rate numeric)
returns numeric(10,2)
language sql
immutable
as $$
  select round(p_gross / (1 + p_rate / 100), 2)::numeric(10,2);
$$;

comment on function public.vat_net_from_gross(numeric, numeric) is
  'Net amount of a gross price at p_rate %; VAT = gross - net (per line).';

-- ---------------------------------------------------------------------------
-- 6. Individual invoice for one completed reservation
-- ---------------------------------------------------------------------------
create or replace function public.create_invoice(
  p_reservation_id uuid,
  p_buyer_name text,
  p_buyer_nip text,
  p_buyer_address text,
  p_buyer_email text default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_res public.reservations%rowtype;
  v_rate numeric(5,2);
  v_num record;
  v_days integer;
  v_gross numeric(10,2);
  v_net numeric(10,2);
  v_invoice_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_res from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'RESERVATION_NOT_FOUND: %', p_reservation_id using errcode = 'P0001';
  end if;
  if v_res.status <> 'completed' then
    raise exception 'RESERVATION_NOT_COMPLETED: %', p_reservation_id using errcode = 'P0001';
  end if;
  if exists (select 1 from public.invoice_items where reservation_id = p_reservation_id) then
    raise exception 'DUPLICATE_INVOICE: %', p_reservation_id using errcode = 'P0001';
  end if;

  v_rate := coalesce(nullif(public.setting_text('vat_rate'), '')::numeric, 23);
  v_gross := v_res.total_cost;
  v_net := public.vat_net_from_gross(v_gross, v_rate);

  if v_res.actual_check_in is not null and v_res.actual_check_out is not null then
    v_days := greatest(1, ceil(extract(epoch from (v_res.actual_check_out - v_res.actual_check_in)) / 86400)::integer);
  else
    v_days := greatest(1, ceil(extract(epoch from (v_res.planned_check_out - v_res.planned_check_in)) / 86400)::integer);
  end if;

  select * into v_num from public.next_invoice_number();

  insert into public.invoices (
    invoice_number, invoice_year, invoice_month, invoice_seq,
    seller_name, seller_address, seller_nip, seller_bank_account,
    buyer_name, buyer_nip, buyer_address, buyer_email,
    issue_date, sale_date, vat_rate, total_net, total_vat, total_amount, created_by
  ) values (
    v_num.invoice_number, v_num.invoice_year, v_num.invoice_month, v_num.invoice_seq,
    public.setting_text('seller_name'), public.setting_text('seller_address'),
    public.setting_text('seller_nip'), public.setting_text('seller_bank_account'),
    p_buyer_name, p_buyer_nip, p_buyer_address, nullif(p_buyer_email, ''),
    (now() at time zone 'Europe/Warsaw')::date,
    (coalesce(v_res.actual_check_out, v_res.planned_check_out) at time zone 'Europe/Warsaw')::date,
    v_rate, v_net, v_gross - v_net, v_gross, v_user
  )
  returning id into v_invoice_id;

  insert into public.invoice_items (
    invoice_id, position, reservation_id, guest_name, license_plate,
    period_start, period_end, parking_type, days_count, description,
    net_amount, vat_amount, gross_amount
  ) values (
    v_invoice_id, 1, v_res.id, concat_ws(' ', v_res.first_name, v_res.last_name), v_res.license_plate,
    v_res.planned_check_in, v_res.planned_check_out, v_res.parking_type, v_days, 'Usługa parkingowa',
    v_net, v_gross - v_net, v_gross
  );

  return v_invoice_id;
end;
$$;

comment on function public.create_invoice(uuid, text, text, text, text) is
  'Issue an individual VAT invoice for a completed reservation (RLS applies: security invoker).';

revoke execute on function public.create_invoice(uuid, text, text, text, text) from anon, public;
revoke execute on function public.next_invoice_number(timestamptz) from anon, public;
grant execute on function public.create_invoice(uuid, text, text, text, text) to authenticated;
grant execute on function public.next_invoice_number(timestamptz) to authenticated;
