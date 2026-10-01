import { useEffect, useMemo, useRef } from "react";
import { KeyRound } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { eventDisplayName, formatDayHeading, groupEventsByHour, layoutShiftsForDay } from "@/lib/calendar/view-model";
import { warsawDateKey, warsawHour, warsawTimeLabel } from "@/lib/calendar/warsaw-time";
import type { CalendarDriverDto, CalendarEventDto, DriverShiftDto } from "@/types";
import { cn } from "@/lib/utils";
import { isCoveredParkingType, parkingTypeLabel } from "@/lib/pricing/parking-type";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

interface CalendarGridProps {
  dateKeys: string[];
  events: CalendarEventDto[];
  shifts: DriverShiftDto[];
  drivers: CalendarDriverDto[];
  isLoading: boolean;
  onEventClick: (event: CalendarEventDto) => void;
  onShiftClick: (shift: DriverShiftDto) => void;
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function CalendarGrid({
  dateKeys,
  events,
  shifts,
  drivers,
  isLoading,
  onEventClick,
  onShiftClick,
}: CalendarGridProps) {
  const eventsByDay = useMemo(
    () => Object.fromEntries(dateKeys.map((dateKey) => [dateKey, groupEventsByHour(events, dateKey)])),
    [dateKeys, events]
  );
  const driverLabels = useMemo(() => Object.fromEntries(drivers.map((driver) => [driver.id, driver.email])), [drivers]);
  const shiftsByDay = useMemo(
    () => Object.fromEntries(dateKeys.map((dateKey) => [dateKey, layoutShiftsForDay(shifts, dateKey)])),
    [dateKeys, shifts]
  );
  const now = new Date();
  const currentDateKey = warsawDateKey(now);
  const currentHour = warsawHour(now);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const scrolledRangeRef = useRef<string | null>(null);
  const rangeKey = dateKeys.join(",");

  // Once per range, bring the relevant hour into view instead of always opening at 00:00 —
  // on small screens only a few hours fit. Background refetches don't move the scroll.
  useEffect(() => {
    // The skeleton replaces the grid while loading, so the fresh grid must be scrolled again.
    if (isLoading) {
      scrolledRangeRef.current = null;
      return;
    }
    if (scrolledRangeRef.current === rangeKey) return;
    const container = scrollRef.current;
    if (!container) return;
    scrolledRangeRef.current = rangeKey;
    let targetHour = 0;
    if (dateKeys.includes(currentDateKey)) {
      targetHour = Math.max(currentHour - 1, 0);
    } else {
      const busyHours = dateKeys.flatMap((dateKey) => [
        ...Object.entries(eventsByDay[dateKey] ?? {})
          .filter(([, list]) => list.length > 0)
          .map(([hour]) => Number(hour)),
        ...(shiftsByDay[dateKey] ?? []).map((layout) => Math.floor(layout.startHour)),
      ]);
      if (busyHours.length > 0) targetHour = Math.min(...busyHours);
    }
    const row = container.querySelector<HTMLElement>(`[data-hour="${targetHour}"]`);
    if (row) container.scrollTop = row.offsetTop - (headerRef.current?.offsetHeight ?? 0);
    // Week view on a phone shows ~2 days — start at today's column.
    const todayColumn = container.querySelector<HTMLElement>(`[data-date="${currentDateKey}"]`);
    container.scrollLeft = todayColumn ? todayColumn.offsetLeft - (headerRef.current?.offsetWidth ?? 0) : 0;
  }, [isLoading, rangeKey, dateKeys, currentDateKey, currentHour, eventsByDay, shiftsByDay]);

  if (isLoading) {
    return (
      <div className="min-h-0 flex-1 space-y-2 overflow-hidden rounded-lg border bg-card p-2 sm:p-4">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="relative min-h-0 flex-1 overflow-auto rounded-lg border bg-card [--day-col:7.5rem] [--hour-col:2.75rem] [--hour-row:3rem] sm:[--hour-col:3.5rem] md:[--hour-row:3.5rem] lg:[--day-col:9rem]"
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `var(--hour-col) repeat(${dateKeys.length}, minmax(var(--day-col), 1fr))`,
          gridTemplateRows: "auto repeat(24, minmax(var(--hour-row), auto))",
        }}
      >
        <div
          ref={headerRef}
          className="sticky top-0 left-0 z-30 border-b bg-card"
          style={{ gridColumn: 1, gridRow: 1 }}
        />
        {dateKeys.map((dateKey, index) => (
          <div
            key={dateKey}
            data-date={dateKey}
            className="sticky top-0 z-20 border-b bg-card px-1 py-1.5 text-center text-xs font-medium capitalize sm:px-2 sm:py-2 sm:text-sm"
            style={{ gridColumn: index + 2, gridRow: 1 }}
          >
            {formatDayHeading(dateKey)}
          </div>
        ))}

        {HOURS.map((hour) => (
          <div
            key={hour}
            data-hour={hour}
            className={cn(
              "sticky left-0 z-10 border-b bg-card px-1 py-1.5 text-right text-[11px] text-muted-foreground sm:px-2 sm:py-2 sm:text-xs",
              hour === currentHour && "bg-accent font-medium text-foreground"
            )}
            style={{ gridColumn: 1, gridRow: hour + 2 }}
          >
            {hourLabel(hour)}
          </div>
        ))}

        {dateKeys.map((dateKey, dayIndex) =>
          HOURS.map((hour) => {
            const isNow = hour === currentHour && dateKey === currentDateKey;
            return (
              <div
                key={`${dateKey}-${hour}-slot`}
                className={cn("border-b border-l", isNow && "bg-accent/40")}
                style={{ gridColumn: dayIndex + 2, gridRow: hour + 2 }}
              />
            );
          })
        )}

        {dateKeys.map((dateKey, dayIndex) =>
          (shiftsByDay[dateKey] ?? []).map((layout) => {
            const startRow = Math.floor(layout.startHour) + 2;
            const endRow = Math.max(Math.ceil(layout.endHour) + 2, startRow + 1);
            const widthPct = 100 / layout.laneCount;
            const driverLabel = driverLabels[layout.shift.driver_user_id] ?? "Zmiana";
            const timeRange = `${warsawTimeLabel(new Date(layout.shift.starts_at))}–${warsawTimeLabel(new Date(layout.shift.ends_at))}`;
            return (
              <button
                key={`${dateKey}-${layout.shift.id}`}
                type="button"
                onClick={() => onShiftClick(layout.shift)}
                title={`${driverLabel} ${timeRange}`}
                className="z-[1] overflow-hidden rounded border border-dashed border-sky-300 bg-sky-100 px-1.5 py-1 text-left text-[11px] leading-4 text-sky-900"
                style={{
                  gridColumn: dayIndex + 2,
                  gridRow: `${startRow} / ${endRow}`,
                  width: `calc(${widthPct}% - 6px)`,
                  marginLeft: `calc(${layout.lane * widthPct}% + 3px)`,
                  marginTop: 2,
                  marginBottom: 2,
                  justifySelf: "start",
                }}
              >
                <span className="font-medium">{driverLabel}</span>
                <span className="mt-0.5 block text-[10px] opacity-80">{timeRange}</span>
              </button>
            );
          })
        )}

        {dateKeys.map((dateKey, dayIndex) =>
          HOURS.map((hour) => {
            const cellEvents = eventsByDay[dateKey]?.[hour] ?? [];
            if (cellEvents.length === 0) return null;
            return (
              <div
                key={`${dateKey}-${hour}-events`}
                className="pointer-events-none z-[2] flex flex-col justify-end gap-1 px-1 py-1 sm:px-1.5"
                style={{ gridColumn: dayIndex + 2, gridRow: hour + 2 }}
              >
                {cellEvents.map((calendarEvent) => (
                  <EventChip
                    key={`${calendarEvent.kind}-${calendarEvent.reservationId}`}
                    event={calendarEvent}
                    onClick={onEventClick}
                  />
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function EventChip({ event, onClick }: { event: CalendarEventDto; onClick: (event: CalendarEventDto) => void }) {
  const isArrival = event.kind === "arrival";
  const kindLabel = isArrival ? "Przyjazd" : "Wyjazd";
  const garageSuffix = isCoveredParkingType(event.parkingType)
    ? `${parkingTypeLabel(event.parkingType)}${event.garageSpotName ? `: ${event.garageSpotName}` : ""}`
    : null;
  // Departures: the flight the client returns from — helps plan the pickup.
  const flightDirection = !isArrival && event.flightDirection ? event.flightDirection : null;
  const keysLeft = !isArrival && event.keysLeft;
  const summary = [
    kindLabel,
    warsawTimeLabel(new Date(event.at)),
    eventDisplayName(event),
    event.licensePlate,
    flightDirection ? `✈ ${flightDirection}` : null,
    garageSuffix,
    keysLeft ? "· zostawił kluczyki" : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      onClick={(click) => {
        click.stopPropagation();
        onClick(event);
      }}
      className={cn(
        "pointer-events-auto block w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] leading-4",
        isArrival ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800",
        event.handled && "line-through opacity-70"
      )}
      title={event.handled ? `${summary} · obsłużone` : summary}
      aria-label={event.handled ? `${summary}, obsłużone` : summary}
    >
      {keysLeft ? <KeyRound className="mr-0.5 inline h-3 w-3 align-[-2px] text-amber-600" aria-hidden /> : null}
      <span className="font-medium">{warsawTimeLabel(new Date(event.at))}</span> {eventDisplayName(event)}
      {event.licensePlate ? ` · ${event.licensePlate}` : ""}
      {flightDirection ? ` · ✈ ${flightDirection}` : ""}
      {garageSuffix ? ` · ${garageSuffix}` : ""}
    </button>
  );
}
