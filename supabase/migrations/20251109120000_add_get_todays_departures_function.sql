-- Migration: Add get_todays_departures function
-- Description: Creates a function to retrieve all reservations where planned_check_out date is today
-- Author: AI Assistant
-- Date: 2025-11-09

-- Create function to get today's departures
create or replace function public.get_todays_departures()
returns setof reservations as $$
begin
  return query
  select *
  from public.reservations
  where date(planned_check_out) = current_date
  order by planned_check_out asc;
end;
$$ language plpgsql security definer;
