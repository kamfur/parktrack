import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CALENDAR_VISIBILITY,
  filterVisibleEvents,
  filterVisibleShifts,
  stepAnchorDate,
  visibleRange,
  type CalendarViewMode,
  type CalendarVisibility,
} from "@/lib/calendar/view-model";
import { warsawDateKey } from "@/lib/calendar/warsaw-time";
import type { CalendarDriverDto, CalendarEventDto, CalendarMonthDayDto, DriverShiftDto } from "@/types";

async function readData<T>(response: Response, fallback: T): Promise<T> {
  if (!response.ok) {
    if (response.status === 503) return fallback;
    throw new Error(`Request failed (${response.status})`);
  }
  const body = (await response.json()) as { data?: T };
  return body.data ?? fallback;
}

export function useParkingCalendar() {
  const [view, setView] = useState<CalendarViewMode>("day");
  const [anchorDate, setAnchorDate] = useState(() => warsawDateKey(new Date()));
  const [visibility, setVisibility] = useState<CalendarVisibility>(DEFAULT_CALENDAR_VISIBILITY);
  const [events, setEvents] = useState<CalendarEventDto[]>([]);
  const [shifts, setShifts] = useState<DriverShiftDto[]>([]);
  const [monthDays, setMonthDays] = useState<CalendarMonthDayDto[]>([]);
  const [drivers, setDrivers] = useState<CalendarDriverDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const range = useMemo(() => visibleRange(view, anchorDate), [view, anchorDate]);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams({ from: range.from, to: range.to, view });

      if (view === "month") {
        const monthRes = await fetch(`/api/calendar/month?${params.toString()}`);
        const nextDays = await readData<CalendarMonthDayDto[]>(monthRes, []);
        if (!monthRes.ok && monthRes.status !== 503) throw new Error("Nie udało się pobrać podsumowania miesiąca");
        setMonthDays(nextDays);
        setEvents([]);
        setShifts([]);
        return;
      }

      const [eventsRes, shiftsRes, driversRes] = await Promise.all([
        fetch(`/api/calendar/events?${params.toString()}`),
        fetch(`/api/shifts?${new URLSearchParams({ from: range.from, to: range.to }).toString()}`),
        fetch("/api/drivers"),
      ]);

      const [nextEvents, nextShifts, nextDrivers] = await Promise.all([
        readData<CalendarEventDto[]>(eventsRes, []),
        readData<DriverShiftDto[]>(shiftsRes, []),
        readData<CalendarDriverDto[]>(driversRes, []),
      ]);

      if (!eventsRes.ok && eventsRes.status !== 503) throw new Error("Nie udało się pobrać wydarzeń kalendarza");
      if (!shiftsRes.ok && shiftsRes.status !== 503) throw new Error("Nie udało się pobrać zmian kierowców");

      setEvents(nextEvents);
      setShifts(nextShifts);
      setDrivers(nextDrivers);
      setMonthDays([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error("Nie udało się załadować kalendarza"));
    } finally {
      setIsLoading(false);
    }
  }, [range.from, range.to, view]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const visibleEvents = useMemo(() => filterVisibleEvents(events, visibility), [events, visibility]);
  const visibleShifts = useMemo(() => filterVisibleShifts(shifts, visibility), [shifts, visibility]);

  return {
    view,
    setView,
    anchorDate,
    dateKeys: range.dateKeys,
    visibility,
    toggleLayer: (layer: keyof CalendarVisibility) => {
      setVisibility((current) => ({ ...current, [layer]: !current[layer] }));
    },
    goToday: () => setAnchorDate(warsawDateKey(new Date())),
    goPrev: () => setAnchorDate((current) => stepAnchorDate(view, current, -1)),
    goNext: () => setAnchorDate((current) => stepAnchorDate(view, current, 1)),
    openDay: (dateKey: string) => {
      setAnchorDate(dateKey);
      setView("day");
    },
    events: visibleEvents,
    shifts: visibleShifts,
    monthDays,
    drivers,
    isLoading,
    error,
    refetch: fetchData,
  };
}
