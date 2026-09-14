import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formatRangeHeading, type CalendarViewMode, type CalendarVisibility } from "@/lib/calendar/view-model";

interface CalendarToolbarProps {
  view: CalendarViewMode;
  dateKeys: string[];
  visibility: CalendarVisibility;
  onViewChange: (view: CalendarViewMode) => void;
  onToggleLayer: (layer: keyof CalendarVisibility) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const VIEWS: { id: CalendarViewMode; label: string }[] = [
  { id: "day", label: "Dzień" },
  { id: "week", label: "Tydzień" },
];

const LAYERS: { id: keyof CalendarVisibility; label: string; swatch: string }[] = [
  { id: "arrivals", label: "Przyjazdy", swatch: "bg-orange-400" },
  { id: "departures", label: "Wyjazdy", swatch: "bg-violet-500" },
  { id: "shifts", label: "Zmiany", swatch: "bg-sky-500" },
];

export function CalendarToolbar({
  view,
  dateKeys,
  visibility,
  onViewChange,
  onToggleLayer,
  onPrev,
  onNext,
  onToday,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={onPrev} aria-label="Poprzedni zakres">
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday}>
          Dziś
        </Button>
        <Button variant="outline" size="icon" onClick={onNext} aria-label="Następny zakres">
          <ChevronRight />
        </Button>
        <h2 className="ml-1 text-lg font-semibold capitalize">{formatRangeHeading(view, dateKeys)}</h2>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-2" role="group" aria-label="Widok kalendarza">
          {VIEWS.map(({ id, label }) => (
            <Button
              key={id}
              size="sm"
              variant={view === id ? "default" : "outline"}
              aria-pressed={view === id}
              onClick={() => onViewChange(id)}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Widoczność warstw">
          {LAYERS.map(({ id, label, swatch }) => (
            <Label key={id} htmlFor={`calendar-layer-${id}`} className="cursor-pointer font-normal">
              <Checkbox
                id={`calendar-layer-${id}`}
                checked={visibility[id]}
                onCheckedChange={() => onToggleLayer(id)}
              />
              <span className={`size-2.5 rounded-full ${swatch}`} aria-hidden="true" />
              {label}
            </Label>
          ))}
        </div>
      </div>
    </div>
  );
}
