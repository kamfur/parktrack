-- Migration: Garage assignment history
-- Intent: link a reservation to its assigned garage/carport spot, with a
--         history trail so a swap supersedes rather than overwrites the
--         prior assignment (garage-carport-slots change, phase 1)

create table public.garage_assignments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id),
  garage_spot_id uuid not null references public.garage_spots(id),
  assigned_at timestamptz not null default now(),
  assigned_by text not null check (assigned_by in ('system', 'staff')),
  superseded_at timestamptz null,
  created_at timestamptz not null default now()
);

comment on table public.garage_assignments is
  'Reservation-to-garage-spot assignment history; superseded_at null = currently active assignment.';

-- Exactly one active (non-superseded) assignment per reservation.
create unique index garage_assignments_active_reservation_idx
  on public.garage_assignments (reservation_id)
  where superseded_at is null;

-- Supports the buffer-check query: active assignments for a given spot, ordered by time.
create index garage_assignments_active_spot_time_idx
  on public.garage_assignments (garage_spot_id, assigned_at)
  where superseded_at is null;

alter table public.garage_assignments enable row level security;

create policy "Staff manage garage_assignments"
  on public.garage_assignments for all
  to authenticated
  using (public.is_staff_role())
  with check (public.is_staff_role());

create policy "Authenticated read garage_assignments"
  on public.garage_assignments for select
  to authenticated
  using (true);
