-- Allow free-text flight destination/route instead of departure/arrival enum.
alter table public.reservations
  drop constraint if exists reservations_flight_direction_check;
