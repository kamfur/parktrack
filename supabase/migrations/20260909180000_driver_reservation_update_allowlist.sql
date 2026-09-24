-- Tighten driver reservation UPDATE to an allowlist of operational columns.
-- Freeze total_cost on the incoming row; trg_update_cost (later BEFORE UPDATE)
-- still recalculates when planned_check_out changes.

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

drop policy if exists "Drivers can select reservations" on public.reservations;
create policy "Drivers can select reservations"
  on public.reservations for select
  to authenticated
  using (
    public.is_driver_role()
    and status in ('confirmed', 'in_progress')
  );
