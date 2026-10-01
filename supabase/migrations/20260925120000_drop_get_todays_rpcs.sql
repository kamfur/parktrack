-- Migration: Drop dead get_todays_* RPCs and lock down SECURITY DEFINER exposure
--
-- get_todays_arrivals / get_todays_departures are not called from the app, use UTC
-- current_date, and run as SECURITY DEFINER — anyone holding the public anon key could
-- read reservation PII through PostgREST. Drop them.
--
-- get_system_user() is SECURITY DEFINER and may insert into auth.users; it was
-- executable by anon. The app now calls it only via the service-role client
-- (external API) or as an authenticated staff user, so revoke it from anon/public.
--
-- Remaining SECURITY DEFINER functions:
--   * update_daily_occupancy, update_reservation_cost — trigger functions (not RPC-callable).
--   * calculate_total_cost — pure pricing calculation, used by the external API
--     cost lookup; left executable (no PII).

drop function if exists public.get_todays_arrivals();
drop function if exists public.get_todays_departures();

revoke execute on function public.get_system_user() from public;
revoke execute on function public.get_system_user() from anon;
grant execute on function public.get_system_user() to authenticated;
grant execute on function public.get_system_user() to service_role;
