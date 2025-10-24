-- Migration: Initial Schema for ParkTrack MVP
-- Description: Creates the initial database schema including tables, types, functions, and policies
-- Author: AI Assistant
-- Date: 2025-10-17

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";

-- Create custom types in public schema
create type public.reservation_status as enum (
  'confirmed',    -- Initial state after creation
  'in_progress',  -- After check-in
  'completed',    -- After check-out
  'cancelled',    -- Cancelled by staff/customer
  'no_show'       -- Customer didn't arrive
);

create type public.payment_status as enum (
  'pending',
  'completed',
  'refunded'
);

create type public.reservation_source as enum (
  'phone',      -- Created by staff via phone
  'walk_in',    -- Created by staff for walk-in customer
  'api'         -- Created via external API
);

-- Core Tables

-- Main reservations table
create table public.reservations (
  id uuid primary key default uuid_generate_v4(),
  -- Customer information
  last_name text not null,
  first_name text,
  email text,
  phone text,
  flight_direction text check (flight_direction in ('departure', 'arrival')),
  license_plate text,
  
  -- Reservation details
  status public.reservation_status not null default 'confirmed',
  source public.reservation_source not null,
  total_cost decimal(10,2) not null,
  is_paid boolean not null default false,
  notes text,
  
  -- Planned dates
  planned_check_in timestamptz not null,
  planned_check_out timestamptz not null,
  
  -- Actual dates
  actual_check_in timestamptz,
  actual_check_out timestamptz,
  
  -- Metadata (Supabase managed)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  last_modified_by uuid not null references auth.users(id),
  
  -- Constraints
  constraint check_dates check (planned_check_out > planned_check_in),
  constraint check_actual_dates check (
    (actual_check_out is null) or 
    (actual_check_in is not null and actual_check_out > actual_check_in)
  )
);

-- Daily parking occupancy
create table public.daily_occupancy (
  date date primary key,
  occupied_spots integer not null default 0,
  updated_at timestamptz not null default now(),
  
  constraint positive_spots check (occupied_spots >= 0)
);

-- Payments tracking
create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  amount decimal(10,2) not null,
  status public.payment_status not null default 'pending',
  payment_date timestamptz not null default now(),
  notes text,
  
  -- Metadata (Supabase managed)
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  
  constraint positive_amount check (amount > 0)
);

-- Configuration Tables

-- Global settings
create table public.settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id)
);

-- Pricing rules
create table public.pricing_rules (
  id uuid primary key default uuid_generate_v4(),
  days_from integer not null,
  days_to integer not null,
  price_per_day decimal(10,2) not null,
  is_active boolean not null default true,
  
  -- Metadata (Supabase managed)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint valid_range check (days_to >= days_from),
  constraint positive_price check (price_per_day > 0),
  unique (days_from, days_to)
);

-- Transfer vehicles
create table public.transfer_vehicles (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  license_plate text not null unique,
  capacity integer not null,
  is_active boolean not null default true,
  notes text,
  
  -- Metadata (Supabase managed)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint positive_capacity check (capacity > 0)
);

-- Database Functions

-- Automatically update updated_at columns
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create updated_at triggers for all tables
create trigger handle_updated_at
  before update on public.reservations
  for each row
  execute function public.handle_updated_at();

create trigger handle_updated_at
  before update on public.daily_occupancy
  for each row
  execute function public.handle_updated_at();

create trigger handle_updated_at
  before update on public.settings
  for each row
  execute function public.handle_updated_at();

create trigger handle_updated_at
  before update on public.pricing_rules
  for each row
  execute function public.handle_updated_at();

create trigger handle_updated_at
  before update on public.transfer_vehicles
  for each row
  execute function public.handle_updated_at();

-- Calculate total cost based on pricing rules
create or replace function public.calculate_total_cost(
  p_check_in timestamptz,
  p_check_out timestamptz
) returns decimal(10,2) as $$
declare
  v_total_days integer;
  v_total_cost decimal(10,2) := 0;
  v_rule record;
begin
  v_total_days := ceil(extract(epoch from (p_check_out - p_check_in)) / 86400);
  
  for v_rule in 
    select * from public.pricing_rules 
    where is_active = true 
    order by days_from
  loop
    if v_total_days >= v_rule.days_from then
      v_total_cost := v_total_cost + (
        least(
          v_total_days - v_rule.days_from + 1,
          v_rule.days_to - v_rule.days_from + 1
        ) * v_rule.price_per_day
      );
    end if;
  end loop;
  
  return v_total_cost;
end;
$$ language plpgsql security definer;

-- Update daily_occupancy
create or replace function public.update_daily_occupancy()
returns trigger as $$
begin
  -- Implementation will be added after confirming exact business logic
  return new;
end;
$$ language plpgsql security definer;

-- Create occupancy trigger
create trigger trg_update_occupancy
  after insert or update or delete on public.reservations
  for each row
  execute function public.update_daily_occupancy();

-- Update reservation cost on date changes
create or replace function public.update_reservation_cost()
returns trigger as $$
begin
  if (new.planned_check_in != old.planned_check_in) or 
     (new.planned_check_out != old.planned_check_out) then
    new.total_cost := public.calculate_total_cost(new.planned_check_in, new.planned_check_out);
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_update_cost
  before update on public.reservations
  for each row
  execute function public.update_reservation_cost();

-- Enable RLS on all tables
alter table public.reservations enable row level security;
alter table public.daily_occupancy enable row level security;
alter table public.payments enable row level security;
alter table public.settings enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.transfer_vehicles enable row level security;

-- Create policies for authenticated access
create policy "Authenticated users can view all reservations"
  on public.reservations for select
  to authenticated
  using (true);

create policy "Authenticated users can insert reservations"
  on public.reservations for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update reservations"
  on public.reservations for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated access"
  on public.daily_occupancy for all
  to authenticated
  using (true);

create policy "Authenticated access"
  on public.payments for all
  to authenticated
  using (true);

create policy "Authenticated access"
  on public.settings for all
  to authenticated
  using (true);

create policy "Authenticated access"
  on public.pricing_rules for all
  to authenticated
  using (true);

create policy "Authenticated access"
  on public.transfer_vehicles for all
  to authenticated
  using (true);

-- Enable realtime for core tables
alter publication supabase_realtime add table reservations;
alter publication supabase_realtime add table daily_occupancy;
alter publication supabase_realtime add table payments;

-- Schedule cleanup of old customer data (using pg_cron)
select cron.schedule(
  'cleanup-old-reservations',
  '0 0 * * *', -- Run daily at midnight
  $$
    update public.reservations
    set 
      first_name = null,
      email = null,
      phone = null,
      license_plate = null
    where 
      status = 'completed' 
      and actual_check_out < now() - interval '1 month'
  $$
);

-- Create a function to get or create system user
create or replace function get_system_user()
returns uuid as $$
declare
  system_user_id uuid;
begin
  -- Try to get existing system user
  select id into system_user_id
  from auth.users
  where email = 'system@parktrack.local'
  limit 1;
  
  -- If not found, create one
  if system_user_id is null then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    values (
      '00000000-0000-0000-0000-000000000000'::uuid,
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'system@parktrack.local',
      '',
      now(),
      now(),
      now(),
      '{"provider": "local", "providers": ["local"]}',
      '{"role": "system"}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    returning id into system_user_id;
  end if;
  
  return system_user_id;
end;
$$ language plpgsql security definer;

-- Insert initial data using system user
do $$
declare
  v_system_user_id uuid;
begin
  v_system_user_id := get_system_user();
  
  insert into public.settings (key, value, description, updated_by) 
  values
    ('total_parking_spots', '"100"', 'Total number of parking spots available', v_system_user_id),
    ('reservation_buffer', '"30"', 'Buffer time in minutes between reservations', v_system_user_id),
    ('default_currency', '"PLN"', 'Default currency for payments', v_system_user_id),
    ('retention_period_days', '"30"', 'Number of days to keep customer data', v_system_user_id);
end;
$$;

-- Insert initial pricing rules
do $$
declare
  v_system_user_id uuid;
begin
  v_system_user_id := get_system_user();
  
  insert into public.pricing_rules (days_from, days_to, price_per_day) 
  values
    (1, 7, 30.00),    -- First week
    (8, 14, 25.00),   -- Second week
    (15, 999, 20.00); -- Beyond two weeks
end;
$$;