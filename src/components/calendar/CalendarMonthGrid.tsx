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
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-1 overflow-hidden rounded-lg border bg-card p-2 sm:gap-2 sm:p-4">
        {Array.from({ length: 35 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full sm:h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-lg border bg-card">
      <div className="sticky top-0 z-10 grid shrink-0 grid-cols-7 border-b bg-card">
        {WEEKDAYS.map((label) => (
          <div
            key={label}
            className="px-1 py-1.5 text-center text-xs font-medium text-muted-foreground sm:px-2 sm:py-2"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid flex-1 auto-rows-[minmax(4.5rem,1fr)] grid-cols-7 sm:auto-rows-[minmax(6rem,1fr)]">
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
                "flex min-w-0 flex-col items-start gap-0.5 border-r border-b px-1 py-1 text-left last:border-r-0 hover:bg-accent/50 sm:gap-1 sm:px-2 sm:py-2",
                !inMonth && "bg-muted/30 text-muted-foreground",
                dateKey === today && "ring-inset ring-2 ring-primary"
              )}
              aria-label={`Otwórz dzień ${dateKey}`}
            >
              <span className={cn("text-sm font-semibold", dateKey === today && "text-primary")}>{dayNumber}</span>
              {visibility.arrivals ? (
                <MonthCount label="Przyjazdy" value={counts.arrivals} dot="bg-emerald-400" text="text-emerald-700" />
              ) : null}
              {visibility.departures ? (
                <MonthCount label="Wyjazdy" value={counts.departures} dot="bg-rose-400" text="text-rose-700" />
              ) : null}
              <MonthCount label="Pobyty" value={counts.occupancy} dot="bg-sky-500" text="text-sky-800" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Phones: 7 columns leave ~50px per day, so labels collapse to a colour dot + count.
function MonthCount({ label, value, dot, text }: { label: string; value: number; dot: string; text: string }) {
  return (
    <span className={cn("flex items-center gap-1 text-[11px] leading-tight", text)} title={`${label} ${value}`}>
      <span className={cn("size-1.5 shrink-0 rounded-full sm:hidden", dot)} aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}
