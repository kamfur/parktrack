-- Migration: monthly travel-agency invoicing + locks on invoiced reservations
-- Affected: invoices (unique agency-month), agency_month_summary(), create_agency_invoice(),
--           trg_block_invoiced_reservation (BEFORE INSERT OR UPDATE on reservations)
-- Intent: one VAT invoice per agency per billing month (month of planned check-in, Europe/Warsaw),
--         one line per arrived reservation. Issuing requires a closed month and no unresolved
--         arrivals. Once invoiced, a reservation's billing fields are immutable, and no reservation
--         can slip into an agency-month that was already invoiced (it would never be billed).

create unique index invoices_agency_billing_month_key
  on public.invoices (travel_agency_id, billing_year, billing_month)
  where travel_agency_id is not null;

-- ---------------------------------------------------------------------------
-- Helpers: Warsaw month window [start, end) and billing month of a timestamp
-- ---------------------------------------------------------------------------
create or replace function public.warsaw_month_start(p_year integer, p_month integer)
returns timestamptz
language sql
stable
as $$
  select make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'Europe/Warsaw');
$$;

create or replace function public.warsaw_month_end(p_year integer, p_month integer)
returns timestamptz
language sql
stable
as $$
  select case when p_month = 12
    then make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'Europe/Warsaw')
    else make_timestamptz(p_year, p_month + 1, 1, 0, 0, 0, 'Europe/Warsaw')
  end;
$$;

-- ---------------------------------------------------------------------------
-- Month summary: single source for the agency view and for issuing
-- ---------------------------------------------------------------------------
create or replace function public.agency_month_summary(p_agency_id uuid, p_year integer, p_month integer)
returns table (
  reservation_id uuid,
  last_name text,
  first_name text,
  license_plate text,
  planned_check_in timestamptz,
  planned_check_out timestamptz,
  status public.reservation_status,
  actual_check_in timestamptz,
  actual_check_out timestamptz,
  parking_type text,
  total_cost numeric,
  category text,
  invoice_id uuid,
  invoice_number text,
  net_amount numeric,
  vat_amount numeric,
  gross_amount numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with rate as (
    select coalesce(nullif(public.setting_text('vat_rate'), '')::numeric, 23) as vat_rate
  ),
  base as (
    select
      r.*,
      it.invoice_id as item_invoice_id,
      inv.invoice_number as item_invoice_number,
      it.net_amount as item_net,
      it.vat_amount as item_vat,
      it.gross_amount as item_gross,
      case
        when it.id is not null then 'invoiced'
        when r.status in ('cancelled', 'no_show') then 'excluded'
        when r.actual_check_in is null then 'blocking'
        else 'invoiceable'
      end as category
    from public.reservations r
    left join public.invoice_items it on it.reservation_id = r.id
    left join public.invoices inv on inv.id = it.invoice_id
    where public.is_staff_role()
      and r.travel_agency_id = p_agency_id
      and r.planned_check_in >= public.warsaw_month_start(p_year, p_month)
      and r.planned_check_in < public.warsaw_month_end(p_year, p_month)
  )
  select
    b.id, b.last_name, b.first_name, b.license_plate, b.planned_check_in, b.planned_check_out,
    b.status, b.actual_check_in, b.actual_check_out, b.parking_type, b.total_cost,
    b.category, b.item_invoice_id, b.item_invoice_number,
    case b.category
      when 'invoiced' then b.item_net
      when 'invoiceable' then public.vat_net_from_gross(b.total_cost, rate.vat_rate)
    end,
    case b.category
      when 'invoiced' then b.item_vat
      when 'invoiceable' then b.total_cost - public.vat_net_from_gross(b.total_cost, rate.vat_rate)
    end,
    case b.category
      when 'invoiced' then b.item_gross
      when 'invoiceable' then b.total_cost
    end
  from base b, rate
  order by b.planned_check_in, b.last_name;
$$;

comment on function public.agency_month_summary(uuid, integer, integer) is
  'Agency reservations with planned check-in in the Warsaw month, categorised invoiceable / blocking / excluded / invoiced, with VAT split (current vat_rate for not-yet-invoiced rows).';

-- ---------------------------------------------------------------------------
-- Issue the monthly agency invoice
-- ---------------------------------------------------------------------------
create or replace function public.create_agency_invoice(p_agency_id uuid, p_year integer, p_month integer)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_agency public.travel_agencies%rowtype;
  v_today date := (now() at time zone 'Europe/Warsaw')::date;
  v_rate numeric(5,2);
  v_num record;
  v_invoice_id uuid;
  v_blocking integer;
  v_invoiceable integer;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if p_month < 1 or p_month > 12 then
    raise exception 'INVALID_MONTH: %-%', p_year, p_month using errcode = 'P0001';
  end if;

  select * into v_agency from public.travel_agencies where id = p_agency_id;
  if not found then
    raise exception 'AGENCY_NOT_FOUND: %', p_agency_id using errcode = 'P0001';
  end if;

  if v_today < (public.warsaw_month_end(p_year, p_month) at time zone 'Europe/Warsaw')::date then
    raise exception 'MONTH_NOT_CLOSED: %-%', p_year, p_month using errcode = 'P0001';
  end if;

  -- Serialise issuing per agency-month (the partial unique index is the backstop).
  perform pg_advisory_xact_lock(hashtext('public.create_agency_invoice'), hashtext(p_agency_id::text || p_year || '-' || p_month));

  if exists (
    select 1 from public.invoices
     where travel_agency_id = p_agency_id and billing_year = p_year and billing_month = p_month
  ) then
    raise exception 'ALREADY_INVOICED: %-%', p_year, p_month using errcode = 'P0001';
  end if;

  -- Lock the month's reservations so they cannot change while the invoice is built.
  perform 1 from public.reservations r
   where r.travel_agency_id = p_agency_id
     and r.planned_check_in >= public.warsaw_month_start(p_year, p_month)
     and r.planned_check_in < public.warsaw_month_end(p_year, p_month)
   for update;

  select count(*) filter (where s.category = 'blocking'), count(*) filter (where s.category = 'invoiceable')
    into v_blocking, v_invoiceable
    from public.agency_month_summary(p_agency_id, p_year, p_month) s;

  if v_blocking > 0 then
    raise exception 'BLOCKING_RESERVATIONS: %', v_blocking using errcode = 'P0001';
  end if;
  if v_invoiceable = 0 then
    raise exception 'NOTHING_TO_INVOICE: %-%', p_year, p_month using errcode = 'P0001';
  end if;

  v_rate := coalesce(nullif(public.setting_text('vat_rate'), '')::numeric, 23);
  select * into v_num from public.next_invoice_number();

  insert into public.invoices (
    invoice_number, invoice_year, invoice_month, invoice_seq,
    seller_name, seller_address, seller_nip, seller_bank_account,
    buyer_name, buyer_nip, buyer_address, buyer_email,
    travel_agency_id, billing_year, billing_month,
    issue_date, sale_date, payment_due_date, vat_rate,
    total_net, total_vat, total_amount, created_by
  ) values (
    v_num.invoice_number, v_num.invoice_year, v_num.invoice_month, v_num.invoice_seq,
    public.setting_text('seller_name'), public.setting_text('seller_address'),
    public.setting_text('seller_nip'), public.setting_text('seller_bank_account'),
    v_agency.name, v_agency.nip, v_agency.address, v_agency.email,
    p_agency_id, p_year, p_month,
    v_today, (public.warsaw_month_end(p_year, p_month) at time zone 'Europe/Warsaw')::date - 1,
    v_today + v_agency.payment_term_days, v_rate,
    0, 0, 0, v_user
  )
  returning id into v_invoice_id;

  insert into public.invoice_items (
    invoice_id, position, reservation_id, guest_name, license_plate,
    period_start, period_end, parking_type, days_count, description,
    net_amount, vat_amount, gross_amount
  )
  select
    v_invoice_id,
    row_number() over (order by s.planned_check_in, s.last_name, s.reservation_id),
    s.reservation_id,
    concat_ws(' ', s.first_name, s.last_name),
    s.license_plate,
    s.planned_check_in,
    s.planned_check_out,
    s.parking_type,
    greatest(1, ceil(extract(epoch from (s.planned_check_out - s.planned_check_in)) / 86400)::integer),
    'Usługa parkingowa',
    public.vat_net_from_gross(s.total_cost, v_rate),
    s.total_cost - public.vat_net_from_gross(s.total_cost, v_rate),
    s.total_cost
  from public.agency_month_summary(p_agency_id, p_year, p_month) s
  where s.category = 'invoiceable';

  update public.invoices i
     set total_net = t.net, total_vat = t.vat, total_amount = t.gross
    from (
      select sum(net_amount) as net, sum(vat_amount) as vat, sum(gross_amount) as gross
        from public.invoice_items where invoice_id = v_invoice_id
    ) t
   where i.id = v_invoice_id;

  return v_invoice_id;
end;
$$;

comment on function public.create_agency_invoice(uuid, integer, integer) is
  'Issue the monthly VAT invoice for a travel agency (closed month, no unresolved arrivals, once per agency-month).';

revoke execute on function public.create_agency_invoice(uuid, integer, integer) from anon, public;
revoke execute on function public.agency_month_summary(uuid, integer, integer) from anon, public;
grant execute on function public.create_agency_invoice(uuid, integer, integer) to authenticated;
grant execute on function public.agency_month_summary(uuid, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Locks. Fires first on reservations (alphabetical: trg_block_ < trg_enforce_ < trg_update_).
-- security definer: drivers cannot read invoices, but the lock must apply to them too.
-- ---------------------------------------------------------------------------
create or replace function public.block_invoiced_reservation_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_number text;
begin
  if tg_op = 'UPDATE' then
    select i.invoice_number into v_invoice_number
      from public.invoice_items it
      join public.invoices i on i.id = it.invoice_id
     where it.reservation_id = old.id;

    if found and (
      new.travel_agency_id is distinct from old.travel_agency_id
      or new.planned_check_in is distinct from old.planned_check_in
      or new.planned_check_out is distinct from old.planned_check_out
      or new.parking_type is distinct from old.parking_type
      or new.total_cost is distinct from old.total_cost
      or new.agency_discount_pct is distinct from old.agency_discount_pct
      or (new.status is distinct from old.status and new.status in ('cancelled', 'no_show'))
    ) then
      raise exception 'RESERVATION_INVOICED: %', v_invoice_number using errcode = 'P0001';
    end if;
  end if;

  if new.travel_agency_id is not null
     and (
       tg_op = 'INSERT'
       or new.travel_agency_id is distinct from old.travel_agency_id
       or new.planned_check_in is distinct from old.planned_check_in
     )
     and exists (
       select 1 from public.invoices i
        where i.travel_agency_id = new.travel_agency_id
          and i.billing_year = extract(year from new.planned_check_in at time zone 'Europe/Warsaw')::integer
          and i.billing_month = extract(month from new.planned_check_in at time zone 'Europe/Warsaw')::integer
     )
  then
    raise exception 'AGENCY_MONTH_INVOICED: %', to_char(new.planned_check_in at time zone 'Europe/Warsaw', 'MM/YYYY')
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger trg_block_invoiced_reservation
  before insert or update on public.reservations
  for each row
  execute function public.block_invoiced_reservation_changes();
