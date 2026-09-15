import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  eventDisplayName,
  formatDayHeading,
  groupEventsByHour,
  shiftsOverlappingHour,
} from "@/lib/calendar/view-model";
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
  onSlotClick: (dateKey: string, hour: number) => void;
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
  onSlotClick,
}: CalendarGridProps) {
  const eventsByDay = useMemo(
    () => Object.fromEntries(dateKeys.map((dateKey) => [dateKey, groupEventsByHour(events, dateKey)])),
    [dateKeys, events]
  );
  const driverLabels = useMemo(() => Object.fromEntries(drivers.map((driver) => [driver.id, driver.email])), [drivers]);
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
        style={{ gridTemplateColumns: `3.5rem repeat(${dateKeys.length}, minmax(9rem, 1fr))` }}
      >
        <div className="sticky top-0 z-10 border-b bg-card" />
        {dateKeys.map((dateKey) => (
          <div
            key={dateKey}
            className="sticky top-0 z-10 border-b bg-card px-2 py-2 text-center text-sm font-medium capitalize"
          >
            {formatDayHeading(dateKey)}
          </div>
        ))}

        {HOURS.map((hour) => (
          <HourRow
            key={hour}
            hour={hour}
            dateKeys={dateKeys}
            eventsByDay={eventsByDay}
            shifts={shifts}
            driverLabels={driverLabels}
            isCurrentHour={hour === currentHour}
            currentDateKey={currentDateKey}
            onEventClick={onEventClick}
            onShiftClick={onShiftClick}
            onSlotClick={onSlotClick}
          />
        ))}
      </div>
    </div>
  );
}

function HourRow({
  hour,
  dateKeys,
  eventsByDay,
  shifts,
  driverLabels,
  isCurrentHour,
  currentDateKey,
  onEventClick,
  onShiftClick,
  onSlotClick,
}: {
  hour: number;
  dateKeys: string[];
  eventsByDay: Record<string, CalendarEventDto[][]>;
  shifts: DriverShiftDto[];
  driverLabels: Record<string, string>;
  isCurrentHour: boolean;
  currentDateKey: string;
  onEventClick: (event: CalendarEventDto) => void;
  onShiftClick: (shift: DriverShiftDto) => void;
  onSlotClick: (dateKey: string, hour: number) => void;
}) {
  return (
    <>
      <div
        className={cn(
          "border-b px-2 py-2 text-right text-xs text-muted-foreground",
          isCurrentHour && "bg-accent/40 font-medium text-foreground"
        )}
      >
        {hourLabel(hour)}
      </div>
      {dateKeys.map((dateKey) => {
        const cellEvents = eventsByDay[dateKey]?.[hour] ?? [];
        const cellShifts = shiftsOverlappingHour(shifts, dateKey, hour);
        const isNow = isCurrentHour && dateKey === currentDateKey;
        return (
          <div
            key={`${dateKey}-${hour}`}
            role="button"
            tabIndex={0}
            onClick={() => onSlotClick(dateKey, hour)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onSlotClick(dateKey, hour);
            }}
            className={cn("min-h-14 space-y-1 border-b border-l px-1.5 py-1 text-left", isNow && "bg-accent/40")}
          >
            {cellShifts.map((shift) => (
              <button
                key={shift.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onShiftClick(shift);
                }}
                className="block w-full truncate rounded border border-dashed border-sky-300 bg-sky-100 px-1.5 py-0.5 text-left text-[11px] text-sky-900"
                title={`${driverLabels[shift.driver_user_id] ?? "Zmiana"} ${warsawTimeLabel(new Date(shift.starts_at))}–${warsawTimeLabel(new Date(shift.ends_at))}`}
              >
                {driverLabels[shift.driver_user_id] ?? "Zmiana"}
              </button>
            ))}
            {cellEvents.map((calendarEvent) => (
              <EventChip
                key={`${calendarEvent.kind}-${calendarEvent.reservationId}`}
                event={calendarEvent}
                onClick={onEventClick}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

function EventChip({ event, onClick }: { event: CalendarEventDto; onClick: (event: CalendarEventDto) => void }) {
  const isArrival = event.kind === "arrival";
  return (
    <button
      type="button"
      onClick={(click) => {
        click.stopPropagation();
        onClick(event);
      }}
      className={cn(
        "block w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] leading-4",
        isArrival
          ? "border-orange-200 bg-orange-100 text-orange-950"
          : "border-violet-200 bg-violet-100 text-violet-950"
      )}
      title={`${isArrival ? "Przyjazd" : "Wyjazd"} ${warsawTimeLabel(new Date(event.at))} ${eventDisplayName(event)} ${event.licensePlate ?? ""}`.trim()}
    >
      <span className="font-medium">{warsawTimeLabel(new Date(event.at))}</span> {eventDisplayName(event)}
      {event.licensePlate ? ` · ${event.licensePlate}` : ""}
    </button>
  );
}
