import { Skeleton } from "@/components/ui/skeleton";
import { isInAnchorMonth, type CalendarVisibility } from "@/lib/calendar/view-model";
import { warsawDateKey } from "@/lib/calendar/warsaw-time";
import type { CalendarMonthDayDto } from "@/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

interface CalendarMonthGridProps {
  dateKeys: string[];
  anchorDate: string;
  days: CalendarMonthDayDto[];
  visibility: CalendarVisibility;
  isLoading: boolean;
  onSelectDay: (dateKey: string) => void;
}

export function CalendarMonthGrid({
  dateKeys,
  anchorDate,
  days,
  visibility,
  isLoading,
  onSelectDay,
}: CalendarMonthGridProps) {
  const today = warsawDateKey(new Date());
  const byDate = new Map(days.map((day) => [day.date, day]));

  if (isLoading) {
    return (
      <div className="grid grid-cols-7 gap-2 rounded-lg border bg-card p-4">
        {Array.from({ length: 35 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-lg border bg-card">
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map((label) => (
          <div key={label} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dateKeys.map((dateKey) => {
          const counts = byDate.get(dateKey) ?? { date: dateKey, arrivals: 0, departures: 0, occupancy: 0 };
          const inMonth = isInAnchorMonth(dateKey, anchorDate);
          const dayNumber = Number(dateKey.slice(8, 10));
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDay(dateKey)}
              className={cn(
                "flex min-h-24 flex-col items-start gap-1 border-b border-r px-2 py-2 text-left last:border-r-0 hover:bg-accent/50",
                !inMonth && "bg-muted/30 text-muted-foreground",
                dateKey === today && "ring-inset ring-2 ring-primary"
              )}
              aria-label={`Otwórz dzień ${dateKey}`}
            >
              <span className={cn("text-sm font-semibold", dateKey === today && "text-primary")}>{dayNumber}</span>
              {visibility.arrivals ? (
                <span className="text-[11px] text-orange-700">
                  Przyjazdy <span className="font-semibold">{counts.arrivals}</span>
                </span>
              ) : null}
              {visibility.departures ? (
                <span className="text-[11px] text-violet-700">
                  Wyjazdy <span className="font-semibold">{counts.departures}</span>
                </span>
              ) : null}
              <span className="text-[11px] text-sky-800">
                Pobyty <span className="font-semibold">{counts.occupancy}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
