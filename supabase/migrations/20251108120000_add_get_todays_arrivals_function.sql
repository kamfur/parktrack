-- Migration: Add get_todays_arrivals function
-- Description: Creates a function to retrieve all reservations where planned_check_in date is today
-- Author: AI Assistant
-- Date: 2025-11-08

-- Create function to get today's arrivals
create or replace function public.get_todays_arrivals()
returns setof reservations as $$
begin
  return query
  select *
  from public.reservations
  where date(planned_check_in) = current_date
  order by planned_check_in asc;
end;
$$ language plpgsql security definer;
