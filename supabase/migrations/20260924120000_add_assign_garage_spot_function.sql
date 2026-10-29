-- Migration: Atomic, lock-serialized garage assignment
-- Intent: close the check-then-act race in GarageAllocationService.assign — two
--         concurrent assignments to the same spot could previously both pass
--         the buffer check and both insert. This function re-validates the
--         10h buffer and inserts inside one transaction, serialized per spot
--         by a Postgres advisory lock, without adding a DB-level constraint
--         (keeps the buffer as a service-enforced business rule, per the
--         garage-carport-slots change's recorded design decision).

create or replace function public.assign_garage_spot(
  p_reservation_id uuid,
  p_garage_spot_id uuid,
  p_assigned_by text
) returns public.garage_assignments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_check_in timestamptz;
  v_check_out timestamptz;
  v_buffer interval := interval '10 hours';
  v_conflict boolean;
  v_result public.garage_assignments;
begin
  -- Serializes concurrent assignment attempts for this spot for the duration
  -- of this transaction; released automatically at commit/rollback.
  perform pg_advisory_xact_lock(hashtext(p_garage_spot_id::text));

  select planned_check_in, planned_check_out
    into v_check_in, v_check_out
    from public.reservations
    where id = p_reservation_id;

  if v_check_in is null then
    raise exception 'Reservation % not found', p_reservation_id;
  end if;

  select exists (
    select 1
    from public.garage_assignments ga
    join public.reservations r on r.id = ga.reservation_id
    where ga.garage_spot_id = p_garage_spot_id
      and ga.superseded_at is null
      and not (
        v_check_in - r.planned_check_out >= v_buffer
        or r.planned_check_in - v_check_out >= v_buffer
      )
  ) into v_conflict;

  if v_conflict then
    raise exception 'GARAGE_BUFFER_VIOLATION' using errcode = 'P0001';
  end if;

  insert into public.garage_assignments (reservation_id, garage_spot_id, assigned_by)
  values (p_reservation_id, p_garage_spot_id, p_assigned_by)
  returning * into v_result;

  return v_result;
end;
$$;

comment on function public.assign_garage_spot is
  'Atomically re-validates the 10h garage buffer and inserts the assignment, serialized per garage_spot_id via an advisory lock. Raises GARAGE_BUFFER_VIOLATION on conflict.';
