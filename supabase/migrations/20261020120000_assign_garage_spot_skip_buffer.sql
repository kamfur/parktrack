-- Migration: optional buffer bypass for assign_garage_spot
-- Intent: staff editing a reservation must never be blocked by the 10h garage buffer
--         (a stay without a spot is worse than a tight buffer). p_skip_buffer = true
--         skips the conflict check; the advisory lock and insert stay as before.

drop function if exists public.assign_garage_spot(uuid, uuid, text);

create or replace function public.assign_garage_spot(
  p_reservation_id uuid,
  p_garage_spot_id uuid,
  p_assigned_by text,
  p_skip_buffer boolean default false
) returns public.garage_assignments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_check_in timestamptz;
  v_check_out timestamptz;
  v_buffer interval := interval '10 hours';
  v_conflict boolean := false;
  v_result public.garage_assignments;
begin
  perform pg_advisory_xact_lock(hashtext(p_garage_spot_id::text));

  select planned_check_in, planned_check_out
    into v_check_in, v_check_out
    from public.reservations
    where id = p_reservation_id;

  if v_check_in is null then
    raise exception 'Reservation % not found', p_reservation_id;
  end if;

  if not p_skip_buffer then
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
  end if;

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
  'Atomically re-validates the 10h garage buffer (unless p_skip_buffer) and inserts the assignment, serialized per garage_spot_id via an advisory lock. Raises GARAGE_BUFFER_VIOLATION on conflict.';
