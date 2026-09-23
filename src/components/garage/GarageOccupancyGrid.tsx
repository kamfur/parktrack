import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { addUtcMonths, dateKeysInRange, warsawDayBounds, warsawMonthStart } from "@/lib/calendar/warsaw-time";
import type { GarageOccupancyEntryDto, GarageSpotDto } from "@/types";

interface GarageOccupancyGridProps {
  spots: GarageSpotDto[];
  entries: GarageOccupancyEntryDto[];
  monthAnchor: string;
  isLoading: boolean;
  onMonthChange: (nextAnchor: string) => void;
  onSelectEntry: (entry: GarageOccupancyEntryDto) => void;
}

function monthLabel(monthAnchor: string): string {
  return new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(
    new Date(`${monthAnchor}T12:00:00Z`)
  );
}

/** The entry (if any) occupying `spotId` on the given day, by planned check-in/out overlap. */
function entryForDay(
  entries: GarageOccupancyEntryDto[],
  spotId: string,
  dateKey: string
): GarageOccupancyEntryDto | null {
  const { start, end } = warsawDayBounds(dateKey);
  const dayStart = Date.parse(start);
  const dayEnd = Date.parse(end);
  return (
    entries.find((entry) => {
      if (entry.garageSpotId !== spotId) return false;
      const checkIn = Date.parse(entry.plannedCheckIn);
      const checkOut = Date.parse(entry.plannedCheckOut);
      return checkIn < dayEnd && checkOut > dayStart;
    }) ?? null
  );
}

export function GarageOccupancyGrid({
  spots,
  entries,
  monthAnchor,
  isLoading,
  onMonthChange,
  onSelectEntry,
}: GarageOccupancyGridProps) {
  const monthStart = warsawMonthStart(monthAnchor);
  const nextMonthStart = addUtcMonths(monthStart, 1);
  const dateKeys = dateKeysInRange(monthStart, nextMonthStart);

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="icon" onClick={() => onMonthChange(addUtcMonths(monthStart, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize">{monthLabel(monthAnchor)}</span>
        <Button type="button" variant="outline" size="icon" onClick={() => onMonthChange(addUtcMonths(monthStart, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {spots.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak skonfigurowanych miejsc garażowych</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-32 border-b bg-card px-2 py-1 text-left font-medium">
                  Miejsce
                </th>
                {dateKeys.map((dateKey) => (
                  <th key={dateKey} className="border-b px-1 py-1 text-center font-medium text-muted-foreground">
                    {Number(dateKey.slice(8, 10))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {spots.map((spot) => (
                <tr key={spot.id}>
                  <td className="sticky left-0 z-10 border-b bg-card px-2 py-1 font-medium">{spot.name}</td>
                  {dateKeys.map((dateKey) => {
                    const entry = entryForDay(entries, spot.id, dateKey);
                    return (
                      <td key={dateKey} className="border-b p-0.5">
                        <button
                          type="button"
                          disabled={!entry}
                          onClick={() => entry && onSelectEntry(entry)}
                          title={entry ? entry.lastName : "Dostępne"}
                          className={cn(
                            "block h-8 w-8 truncate rounded text-center leading-8",
                            entry
                              ? "cursor-pointer bg-rose-200 text-rose-900 hover:bg-rose-300"
                              : "bg-emerald-100 text-emerald-800"
                          )}
                        >
                          {entry ? entry.lastName.slice(0, 3) : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
