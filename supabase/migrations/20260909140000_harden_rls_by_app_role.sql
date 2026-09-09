-- Migration: Harden RLS by app_metadata.role (staff vs driver)
-- Affected: reservations, invoices, settings, payments, pricing_rules,
--           daily_occupancy, transfer_vehicles
-- Intent: drivers may read reservations and perform operational UPDATEs only;
--         staff (missing role defaults to staff) keep full authenticated access.
-- External/admin inserts continue to use service_role (bypasses RLS).

-- ---------------------------------------------------------------------------
-- Role helpers (JWT app_metadata.role; missing/empty → staff)
-- ---------------------------------------------------------------------------
create or replace function public.current_app_role()
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''), 'staff');
$$;

comment on function public.current_app_role() is
  'App role from JWT app_metadata.role; empty/missing treated as staff';

create or replace function public.is_staff_role()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.current_app_role() is distinct from 'driver';
$$;

create or replace function public.is_driver_role()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.current_app_role() = 'driver';
$$;

-- ---------------------------------------------------------------------------
-- Driver column / status guard (BEFORE UPDATE)
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

  -- Status transitions: confirmed → in_progress; in_progress → completed
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

  -- Columns drivers must not change (identity / money source / identity fields)
  if new.id is distinct from old.id
     or new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by
     or new.last_modified_by is distinct from old.last_modified_by
     or new.last_name is distinct from old.last_name
     or new.first_name is distinct from old.first_name
     or new.email is distinct from old.email
     or new.phone is distinct from old.phone
     or new.license_plate is distinct from old.license_plate
     or new.planned_check_in is distinct from old.planned_check_in
     or new.source is distinct from old.source
  then
    raise exception 'drivers cannot modify identity or non-operational reservation columns'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_driver_reservation_update on public.reservations;
create trigger trg_enforce_driver_reservation_update
  before update on public.reservations
  for each row
  execute function public.enforce_driver_reservation_update();

-- ---------------------------------------------------------------------------
-- Reservations policies
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can view all reservations" on public.reservations;
drop policy if exists "Authenticated users can insert reservations" on public.reservations;
drop policy if exists "Authenticated users can update reservations" on public.reservations;

create policy "Staff can select reservations"
  on public.reservations for select
  to authenticated
  using (public.is_staff_role());

create policy "Drivers can select reservations"
  on public.reservations for select
  to authenticated
  using (public.is_driver_role());

create policy "Staff can insert reservations"
  on public.reservations for insert
  to authenticated
  with check (public.is_staff_role());

create policy "Staff can update reservations"
  on public.reservations for update
  to authenticated
  using (public.is_staff_role())
  with check (public.is_staff_role());

create policy "Drivers can update operational reservations"
  on public.reservations for update
  to authenticated
  using (
    public.is_driver_role()
    and status in ('confirmed', 'in_progress')
  )
  with check (
    public.is_driver_role()
    and status in ('confirmed', 'in_progress', 'completed')
  );

-- No DELETE policy for authenticated → deny deletes for both roles via RLS
-- (service_role / future staff admin may add explicit staff delete if needed)

-- ---------------------------------------------------------------------------
-- Staff-only tables (drivers denied by absence of driver policies)
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users full access" on public.invoices;
create policy "Staff full access to invoices"
  on public.invoices for all
  to authenticated
  using (public.is_staff_role())
  with check (public.is_staff_role());

drop policy if exists "Authenticated access" on public.settings;
create policy "Staff full access to settings"
  on public.settings for all
  to authenticated
  using (public.is_staff_role())
  with check (public.is_staff_role());

drop policy if exists "Authenticated access" on public.payments;
create policy "Staff full access to payments"
  on public.payments for all
  to authenticated
  using (public.is_staff_role())
  with check (public.is_staff_role());

drop policy if exists "Authenticated access" on public.pricing_rules;
create policy "Staff full access to pricing_rules"
  on public.pricing_rules for all
  to authenticated
  using (public.is_staff_role())
  with check (public.is_staff_role());

drop policy if exists "Authenticated access" on public.daily_occupancy;
create policy "Staff full access to daily_occupancy"
  on public.daily_occupancy for all
  to authenticated
  using (public.is_staff_role())
  with check (public.is_staff_role());

drop policy if exists "Authenticated access" on public.transfer_vehicles;
create policy "Staff full access to transfer_vehicles"
  on public.transfer_vehicles for all
  to authenticated
  using (public.is_staff_role())
  with check (public.is_staff_role());
