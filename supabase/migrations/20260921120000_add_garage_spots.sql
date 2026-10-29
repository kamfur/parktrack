-- Migration: Garage/carport spot inventory
-- Intent: staff-configured inventory of individually assignable garage/carport
--         units (garage-carport-slots change, phase 1)

create table public.garage_spots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  spot_type text not null check (spot_type in ('garage', 'carport')),
  capacity_label text not null check (capacity_label in ('single', 'double')),
  price_per_day decimal(10,2) not null check (price_per_day > 0),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.garage_spots is
  'Individually assignable garage/carport units configured by staff; single/double is a capacity label, not a sub-spot hierarchy.';

create trigger handle_updated_at
  before update on public.garage_spots
  for each row
  execute function public.handle_updated_at();

alter table public.garage_spots enable row level security;

create policy "Staff manage garage_spots"
  on public.garage_spots for all
  to authenticated
  using (public.is_staff_role())
  with check (public.is_staff_role());

create policy "Authenticated read garage_spots"
  on public.garage_spots for select
  to authenticated
  using (true);
