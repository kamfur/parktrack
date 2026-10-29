-- Migration: ParkVia as a reservation source
-- Affected: reservation_source (enum value)
-- Intent: reservations imported from ParkVia (20261007120000) are shown as "ParkVia" in reservation
--         lists, the source filter and stats, instead of the generic "API".

alter type public.reservation_source add value if not exists 'parkvia';
