-- Timed driver assignments displayed and managed from the staff calendar.
create table public.driver_shifts (
  id uuid primary key default gen_random_uuid(),
  driver_user_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint driver_shifts_valid_interval check (ends_at > starts_at)
);

create index driver_shifts_time_range_idx
  on public.driver_shifts (starts_at, ends_at);

create index driver_shifts_driver_user_id_idx
  on public.driver_shifts (driver_user_id);

alter table public.driver_shifts enable row level security;

create policy "Staff full access to driver_shifts"
  on public.driver_shifts for all
  to authenticated
  using (public.is_staff_role())
  with check (public.is_staff_role());

comment on table public.driver_shifts is
  'Timed driver assignments managed by staff; overlapping shifts are allowed';
