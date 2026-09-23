import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { eventDisplayName, formatDayHeading, groupEventsByHour, layoutShiftsForDay } from "@/lib/calendar/view-model";
import { warsawDateKey, warsawHour, warsawTimeLabel } from "@/lib/calendar/warsaw-time";
import type { CalendarDriverDto, CalendarEventDto, DriverShiftDto } from "@/types";
import { cn } from "@/lib/utils";

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

  if (isLoading) {
    return (
      <div className="space-y-2 rounded-lg border bg-card p-4">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-lg border bg-card">
      <div
        className="grid min-w-[36rem]"
        style={{
          gridTemplateColumns: `3.5rem repeat(${dateKeys.length}, minmax(9rem, 1fr))`,
          gridTemplateRows: "auto repeat(24, minmax(3.5rem, auto))",
        }}
      >
        <div className="sticky top-0 z-20 border-b bg-card" style={{ gridColumn: 1, gridRow: 1 }} />
        {dateKeys.map((dateKey, index) => (
          <div
            key={dateKey}
            className="sticky top-0 z-20 border-b bg-card px-2 py-2 text-center text-sm font-medium capitalize"
            style={{ gridColumn: index + 2, gridRow: 1 }}
          >
            {formatDayHeading(dateKey)}
          </div>
        ))}

        {HOURS.map((hour) => (
          <div
            key={hour}
            className={cn(
              "border-b px-2 py-2 text-right text-xs text-muted-foreground",
              hour === currentHour && "bg-accent/40 font-medium text-foreground"
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
                className={cn("min-h-14 border-b border-l", isNow && "bg-accent/40")}
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
                className="pointer-events-none z-[2] flex min-h-14 flex-col justify-end gap-1 px-1.5 py-1"
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
  const garageSuffix =
    event.parkingType === "garage" ? `Garaż${event.garageSpotName ? `: ${event.garageSpotName}` : ""}` : null;
  const summary = [
    kindLabel,
    warsawTimeLabel(new Date(event.at)),
    eventDisplayName(event),
    event.licensePlate,
    garageSuffix,
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
      <span className="font-medium">{warsawTimeLabel(new Date(event.at))}</span> {eventDisplayName(event)}
      {event.licensePlate ? ` · ${event.licensePlate}` : ""}
      {garageSuffix ? ` · ${garageSuffix}` : ""}
    </button>
  );
}
