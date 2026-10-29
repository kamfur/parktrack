-- Demo seed for ParkTrack presentations.
-- Dates are relative to "today" in Europe/Warsaw, so arrivals/departures stay current
-- for the next 2-3 weeks after each reset or re-run.
--
-- Idempotent: only rows whose notes start with `[DEMO]` are replaced.
-- No DO blocks and no dollar-quoting, so every statement below can be pasted
-- separately into the Supabase SQL editor.
--
-- Apply:
--   supabase db reset          (local: migrations + this file)
--   or paste the statements below into the SQL editor (Studio)

-- 1. Clean previous demo rows
delete from public.reservations
where notes like '[DEMO]%';

-- 2. Planned arrivals (status confirmed) - today, overdue and the next 2-3 weeks
insert into public.reservations (
  last_name, first_name, email, phone, flight_direction, license_plate,
  status, source, total_cost, is_paid, notes,
  planned_check_in, planned_check_out,
  created_by, last_modified_by, passenger_count, paid_at_arrival, paid_at_departure
)
select
  t.last_name,
  t.first_name,
  t.slug || '.demo@example.com',
  t.phone,
  t.flight_direction,
  t.license_plate,
  t.status::public.reservation_status,
  t.source::public.reservation_source,
  public.calculate_total_cost(t.check_in, t.check_out),
  t.is_paid,
  '[DEMO] ' || t.note,
  t.check_in,
  t.check_out,
  t.uid,
  t.uid,
  t.pax,
  t.paid_arrival,
  false
from (
  select
    v.*,
    b.uid,
    (((b.today + v.in_off) + v.in_time) at time zone 'Europe/Warsaw') as check_in,
    (((b.today + v.out_off) + v.out_time) at time zone 'Europe/Warsaw') as check_out
  from (
    select
      (timezone('Europe/Warsaw', now()))::date as today,
      coalesce((select id from auth.users order by created_at limit 1), public.get_system_user()) as uid
  ) b,
  (values
    ('Kowalska', 'Anna', 'anna.kowalska', '+48 600 101 101', 'departure', 'KR 8A123', 'confirmed', 'phone',
      0, time '07:15', 5, time '19:40', 2, false, false, 'Przyjazd dzisiaj rano - wylot KRK'),
    ('Nowak', 'Piotr', 'piotr.nowak', '+48 600 101 102', 'departure', 'WA 1234A', 'confirmed', 'api',
      0, '09:40', 8, '16:20', 3, false, false, 'Przyjazd dzisiaj przed poludniem'),
    ('Wisniewski', 'Marek', 'marek.wisniewski', '+48 600 101 103', 'arrival', 'GD 45KL2', 'confirmed', 'walk_in',
      0, '12:10', 3, '13:00', 1, false, false, 'Przyjazd dzisiaj w poludnie - krotki pobyt'),
    ('Zielinska', 'Magda', 'magda.zielinska', '+48 600 101 104', 'departure', 'PO 9C111', 'confirmed', 'phone',
      0, '15:30', 10, '21:15', 4, true, true, 'Przyjazd dzisiaj po poludniu - juz oplacone'),
    ('Wojcik', 'Tomasz', 'tomasz.wojcik', '+48 600 101 105', 'departure', 'LU 321AB', 'confirmed', 'phone',
      0, '18:45', 14, '18:00', 2, false, false, 'Przyjazd dzisiaj wieczorem - urlop 2 tyg.'),
    ('Kaminska', 'Katarzyna', 'katarzyna.kaminska', '+48 600 101 106', 'departure', 'SK 77XY1', 'confirmed', 'api',
      -1, '16:00', 6, '17:30', 2, false, false, 'Spozniony przyjazd - plan wczoraj, auto jeszcze nie oddane'),
    ('Jankowska', 'Barbara', 'barbara.jankowska', '+48 600 101 107', 'departure', 'PO 18NXT', 'confirmed', 'phone',
      1, '08:00', 9, '19:10', 2, false, false, 'Przyjazd jutro rano'),
    ('Mazur', 'Krzysztof', 'krzysztof.mazur', '+48 600 101 108', 'departure', 'KR 44QWE', 'confirmed', 'api',
      3, '10:25', 10, '16:40', 1, true, true, 'Przyjazd za 3 dni - oplacone online'),
    ('Wrobel', 'Aleksandra', 'aleksandra.wrobel', '+48 600 101 109', 'departure', 'WA 2CITY', 'confirmed', 'phone',
      7, '13:50', 14, '13:50', 3, false, false, 'Przyjazd za tydzien'),
    ('Pawlak', 'Marcin', 'marcin.pawlak', '+48 600 101 110', 'departure', 'LU 90HOL', 'confirmed', 'api',
      10, '06:30', 17, '22:15', 2, false, false, 'Przyjazd za ok. 10 dni - wczesny wylot'),
    ('Adamczyk', 'Zofia', 'zofia.adamczyk', '+48 600 101 111', 'departure', 'GD 3WEEK', 'confirmed', 'phone',
      16, '11:05', 21, '18:30', 2, false, false, 'Przyjazd za ok. 2-3 tygodnie'),
    ('Sikora', 'Robert', 'robert.sikora', '+48 600 101 112', 'arrival', 'PO 61RET', 'confirmed', 'walk_in',
      18, '17:20', 20, '09:00', 1, false, false, 'Krotki pobyt weekendowy za ok. 2,5 tygodnia'),
    ('Borkowska', 'Irena', 'irena.borkowska', '+48 600 101 113', 'departure', 'PO 0CNCL', 'cancelled', 'phone',
      4, '09:00', 11, '09:00', 2, false, false, 'Anulowana rezerwacja za 4 dni'),
    ('Gorski', 'Stefan', 'stefan.gorski', '+48 600 101 114', 'departure', 'LU 0SHOW', 'no_show', 'api',
      -2, '10:00', 5, '10:00', 1, false, false, 'No-show - klient nie przyjechal 2 dni temu')
  ) as v(last_name, first_name, slug, phone, flight_direction, license_plate, status, source,
         in_off, in_time, out_off, out_time, pax, is_paid, paid_arrival, note)
) t;

-- 3. On the lot (status in_progress) - today's departures plus longer stays
insert into public.reservations (
  last_name, first_name, email, phone, flight_direction, license_plate,
  status, source, total_cost, is_paid, notes,
  planned_check_in, planned_check_out, actual_check_in,
  created_by, last_modified_by, passenger_count, parking_sector,
  paid_at_arrival, paid_at_departure, surcharge_amount
)
select
  t.last_name,
  t.first_name,
  t.slug || '.demo@example.com',
  t.phone,
  t.flight_direction,
  t.license_plate,
  'in_progress'::public.reservation_status,
  t.source::public.reservation_source,
  public.calculate_total_cost(t.check_in, t.check_out),
  t.paid_arrival,
  '[DEMO] ' || t.note,
  t.check_in,
  t.check_out,
  t.actual_in,
  t.uid,
  t.uid,
  t.pax,
  t.sector,
  t.paid_arrival,
  false,
  t.surcharge
from (
  select
    v.*,
    b.uid,
    (((b.today + v.in_off) + v.in_time) at time zone 'Europe/Warsaw') as check_in,
    (((b.today + v.out_off) + v.out_time) at time zone 'Europe/Warsaw') as check_out,
    (((b.today + v.in_off) + v.ci_time) at time zone 'Europe/Warsaw') as actual_in
  from (
    select
      (timezone('Europe/Warsaw', now()))::date as today,
      coalesce((select id from auth.users order by created_at limit 1), public.get_system_user()) as uid
  ) b,
  (values
    ('Lewandowski', 'Adam', 'adam.lewandowski', '+48 600 101 115', 'arrival', 'KR 1B900', 'phone',
      -7, time '08:20', time '08:28', 0, time '08:10', 2, 'A12', true, null::numeric,
      'Wyjazd dzisiaj rano - zaplacone na przyjezdzie'),
    ('Dabrowska', 'Ewa', 'ewa.dabrowska', '+48 600 101 116', 'arrival', 'WA 88PRT', 'api',
      -4, '11:00', '11:12', 0, '11:20', 3, 'B04', false, null,
      'Wyjazd dzisiaj przed poludniem - do zaplaty u kierowcy'),
    ('Kaczmarek', 'Jan', 'jan.kaczmarek', '+48 600 101 117', 'arrival', 'GD 12LOT', 'phone',
      -5, '09:00', '09:07', 0, '23:45', 4, 'C02', false, null,
      'Wyjazd za chwile - odbior z lotniska'),
    ('Piotrowska', 'Natalia', 'natalia.piotrowska', '+48 600 101 118', 'arrival', 'PO 555KM', 'walk_in',
      -3, '14:30', '14:41', 0, '19:30', 1, 'A03', false, 40.00,
      'Wyjazd dzisiaj wieczorem - mozliwa doplata'),
    ('Grabowski', 'Pawel', 'pawel.grabowski', '+48 600 101 119', 'departure', 'LU 4WN88', 'phone',
      -2, '10:15', '10:22', 3, '18:45', 2, 'A07', true, null,
      'Na parkingu - wyjazd za 3 dni'),
    ('Michalska', 'Joanna', 'joanna.michalska', '+48 600 101 120', 'departure', 'KR 22HKL', 'api',
      -1, '07:50', '08:02', 8, '12:10', 5, 'B11', true, null,
      'Na parkingu - wyjazd za ok. tydzien'),
    ('Szymanski', 'Lukasz', 'lukasz.szymanski', '+48 600 101 121', 'departure', 'WA 901ZX', 'phone',
      0, '06:40', '06:51', 12, '20:00', 2, 'C08', false, null,
      'Na parkingu od dzisiaj rano - wyjazd za ok. 12 dni'),
    ('Krol', 'Agnieszka', 'agnieszka.krol', '+48 600 101 122', 'departure', 'GD 777AB', 'api',
      -4, '13:20', '13:33', 16, '15:00', 3, 'A19', true, null,
      'Dlugi pobyt - wyjazd za ok. 2 tygodnie'),
    ('Wieczorek', 'Michal', 'michal.wieczorek', '+48 600 101 123', 'arrival', 'SK 13BUS', 'phone',
      -6, '09:10', '09:18', 2, '22:40', 4, 'B02', false, null,
      'Na parkingu - wyjazd pojutrze, lot wieczorny')
  ) as v(last_name, first_name, slug, phone, flight_direction, license_plate, source,
         in_off, in_time, ci_time, out_off, out_time, pax, sector, paid_arrival, surcharge, note)
) t;

-- 4. Completed stays (dashboard stats / history)
insert into public.reservations (
  last_name, first_name, email, phone, flight_direction, license_plate,
  status, source, total_cost, is_paid, notes,
  planned_check_in, planned_check_out, actual_check_in, actual_check_out,
  created_by, last_modified_by, passenger_count, parking_sector,
  paid_at_arrival, paid_at_departure, surcharge_amount
)
select
  t.last_name,
  t.first_name,
  t.slug || '.demo@example.com',
  t.phone,
  'arrival',
  t.license_plate,
  'completed'::public.reservation_status,
  t.source::public.reservation_source,
  public.calculate_total_cost(t.check_in, t.check_out),
  true,
  '[DEMO] ' || t.note,
  t.check_in,
  t.check_out,
  t.actual_in,
  t.actual_out,
  t.uid,
  t.uid,
  t.pax,
  t.sector,
  t.paid_arrival,
  true,
  t.surcharge
from (
  select
    v.*,
    b.uid,
    (((b.today + v.in_off) + v.in_time) at time zone 'Europe/Warsaw') as check_in,
    (((b.today + v.out_off) + v.out_time) at time zone 'Europe/Warsaw') as check_out,
    (((b.today + v.in_off) + v.ci_time) at time zone 'Europe/Warsaw') as actual_in,
    (((b.today + v.out_off) + v.co_time) at time zone 'Europe/Warsaw') as actual_out
  from (
    select
      (timezone('Europe/Warsaw', now()))::date as today,
      coalesce((select id from auth.users order by created_at limit 1), public.get_system_user()) as uid
  ) b,
  (values
    ('Ostrowski', 'Dariusz', 'dariusz.ostrowski', '+48 600 101 124', 'KR 5DONE', 'phone',
      -4, time '08:00', time '08:09', 0, time '09:30', time '09:42', 2, 'A01', false, null::numeric,
      'Zakonczona dzisiaj rano - zaplacone przy wyjezdzie'),
    ('Lis', 'Helena', 'helena.lis', '+48 600 101 125', 'WA 19OUT', 'api',
      -10, '12:00', '12:11', -3, '18:00', '19:05', 3, 'B09', true, 60.00,
      'Zakonczona 3 dni temu - doplata za dluzszy pobyt'),
    ('Czarnecki', 'Filip', 'filip.czarnecki', '+48 600 101 126', 'GD 8PAST', 'phone',
      -14, '07:40', '07:48', -7, '20:10', '20:18', 2, 'C05', true, null,
      'Zakonczona tydzien temu')
  ) as v(last_name, first_name, slug, phone, license_plate, source,
         in_off, in_time, ci_time, out_off, out_time, co_time, pax, sector, paid_arrival, surcharge, note)
) t;

-- 5. Pull one departure into the next hour so the "near checkout" badge shows up live.
--    The reservations cost trigger recalculates total_cost on this update.
update public.reservations
set planned_check_out = least(
      now() + interval '50 minutes',
      (((timezone('Europe/Warsaw', now()))::date + 1)::timestamp at time zone 'Europe/Warsaw') - interval '15 minutes'
    )
where notes = '[DEMO] Wyjazd za chwile - odbior z lotniska';

-- 6. Sanity check
select status, count(*) as total
from public.reservations
where notes like '[DEMO]%'
group by status
order by status;
