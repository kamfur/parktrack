-- Migration: agency reservations (discounted price, paid by agency)
-- Affected: reservations (columns), update_reservation_cost() + trg_update_cost (now INSERT OR UPDATE),
--           enforce_driver_reservation_update()
-- Intent: a reservation assigned to a travel agency is paid by the agency (the driver collects
--         nothing) and priced as price list × (1 − discount). The discount is snapshotted from
--         the agency when assigned. Enforced in the DB so every write path (staff form, PATCH,
--         driver endpoints) keeps the price and the paid flag consistent.

alter table public.reservations
  add column travel_agency_id uuid null references public.travel_agencies(id) on delete restrict,
  add column agency_discount_pct numeric(5,2) null check (agency_discount_pct >= 0 and agency_discount_pct <= 100);

comment on column public.reservations.travel_agency_id is 'Paying travel agency; null = individual client.';
comment on column public.reservations.agency_discount_pct is
  'Agency discount % snapshotted when the agency was assigned; maintained by trg_update_cost, never by clients.';

create index reservations_travel_agency_checkin_idx
  on public.reservations (travel_agency_id, planned_check_in)
  where travel_agency_id is not null;

-- ---------------------------------------------------------------------------
-- Pricing + payment trigger (BEFORE INSERT OR UPDATE). Runs after
-- trg_enforce_driver_reservation_update (alphabetical order), so it has the last word.
-- ---------------------------------------------------------------------------
create or replace function public.update_reservation_cost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency record;
  v_agency_changed boolean;
  v_stay_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_agency_changed := new.travel_agency_id is not null;
    v_stay_changed := true;
  else
    v_agency_changed := new.travel_agency_id is distinct from old.travel_agency_id;
    v_stay_changed := new.planned_check_in is distinct from old.planned_check_in
      or new.planned_check_out is distinct from old.planned_check_out
      or new.parking_type is distinct from old.parking_type;
  end if;

  -- Discount snapshot: taken from the agency on assignment only; clients cannot set it.
  if v_agency_changed and new.travel_agency_id is not null then
    select a.discount_pct, a.archived_at
      into v_agency
      from public.travel_agencies a
     where a.id = new.travel_agency_id;
    if not found then
      raise exception 'AGENCY_NOT_FOUND: %', new.travel_agency_id using errcode = 'P0001';
    end if;
    if v_agency.archived_at is not null then
      raise exception 'AGENCY_ARCHIVED: %', new.travel_agency_id using errcode = 'P0001';
    end if;
    new.agency_discount_pct := v_agency.discount_pct;
  elsif new.travel_agency_id is null then
    new.agency_discount_pct := null;
  else
    new.agency_discount_pct := old.agency_discount_pct;
  end if;

  if new.travel_agency_id is not null then
    -- Agency pays: price is always derived (client-sent total_cost ignored).
    if v_agency_changed or v_stay_changed then
      new.total_cost := round(
        public.calculate_total_cost(new.planned_check_in, new.planned_check_out, new.parking_type)
          * (1 - new.agency_discount_pct / 100),
        2
      );
    else
      new.total_cost := old.total_cost;
    end if;
    new.is_paid := true;
    new.paid_at_arrival := false;
    new.paid_at_departure := false;
    new.surcharge_amount := null;
  elsif tg_op = 'UPDATE' then
    -- Individual client: unchanged behaviour (reprice on stay change), plus full price and
    -- driver-derived paid flag when an agency was just removed.
    if v_stay_changed or v_agency_changed then
      new.total_cost := public.calculate_total_cost(new.planned_check_in, new.planned_check_out, new.parking_type);
    end if;
    if v_agency_changed then
      new.is_paid := new.paid_at_arrival or new.paid_at_departure;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_update_cost on public.reservations;
create trigger trg_update_cost
  before insert or update on public.reservations
  for each row
  execute function public.update_reservation_cost();

-- ---------------------------------------------------------------------------
-- Driver allowlist: additionally freeze the agency columns.
-- (Body copied from 20260909180000_driver_reservation_update_allowlist.sql.)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_driver_reservation_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_driver_role() then
    return new;
  end if;

  if old.status = 'confirmed' and new.status not in ('confirmed', 'in_progress') then
    raise exception 'drivers may only move confirmed reservations to in_progress'
      using errcode = '42501';
  end if;

  if old.status = 'in_progress' and new.status not in ('in_progress', 'completed') then
    raise exception 'drivers may only move in_progress reservations to completed'
      using errcode = '42501';
  end if;

  if old.status not in ('confirmed', 'in_progress') then
    raise exception 'drivers cannot update reservations in status %', old.status
      using errcode = '42501';
  end if;

  -- Allowlist: operational driver fields + timestamps the existing triggers maintain.
  if new.id is distinct from old.id
     or new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by
     or new.last_name is distinct from old.last_name
     or new.first_name is distinct from old.first_name
     or new.email is distinct from old.email
     or new.phone is distinct from old.phone
     or new.license_plate is distinct from old.license_plate
     or new.planned_check_in is distinct from old.planned_check_in
     or new.source is distinct from old.source
     or new.travel_agency_id is distinct from old.travel_agency_id
     or new.agency_discount_pct is distinct from old.agency_discount_pct
  then
    raise exception 'drivers cannot modify identity or non-operational reservation columns'
      using errcode = '42501';
  end if;

  -- Ignore client-supplied total_cost; trg_update_cost may overwrite after date edits.
  new.total_cost := old.total_cost;
  new.last_modified_by := auth.uid();

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Individual invoices: reject agency reservations (billed monthly to the agency).
-- (Body from 20260929120000_invoice_items_and_vat.sql + the agency guard.)
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
  -- Agency stays are billed on the agency's monthly invoice, never individually.
  if v_res.travel_agency_id is not null then
    raise exception 'RESERVATION_BILLED_TO_AGENCY: %', p_reservation_id using errcode = 'P0001';
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

