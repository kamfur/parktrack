import { ChevronLeft, ChevronRight, Layers, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatRangeHeading, type CalendarViewMode, type CalendarVisibility } from "@/lib/calendar/view-model";
import { cn } from "@/lib/utils";

interface CalendarToolbarProps {
  view: CalendarViewMode;
  dateKeys: string[];
  anchorDate: string;
  visibility: CalendarVisibility;
  onViewChange: (view: CalendarViewMode) => void;
  onToggleLayer: (layer: keyof CalendarVisibility) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onNewReservation: () => void;
  onAddShift: () => void;
}

const VIEWS: { id: CalendarViewMode; label: string }[] = [
  { id: "day", label: "Dzień" },
  { id: "week", label: "Tydzień" },
  { id: "month", label: "Miesiąc" },
];

const LAYERS: { id: keyof CalendarVisibility; label: string; swatch: string }[] = [
  { id: "arrivals", label: "Przyjazdy", swatch: "bg-emerald-400" },
  { id: "departures", label: "Wyjazdy", swatch: "bg-rose-400" },
  { id: "shifts", label: "Zmiany", swatch: "bg-sky-500" },
];

export function CalendarToolbar({
  view,
  dateKeys,
  anchorDate,
  visibility,
  onViewChange,
  onToggleLayer,
  onPrev,
  onNext,
  onToday,
  onNewReservation,
  onAddShift,
}: CalendarToolbarProps) {
  const layers = LAYERS.filter((layer) => view !== "month" || layer.id !== "shifts");
  const hiddenLayers = layers.filter((layer) => !visibility[layer.id]).length;

  return (
    <div className="flex shrink-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
      {/* Row 1 (mobile/tablet): navigation + heading + compact actions. */}
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <Button
          variant="outline"
          size="icon"
          className="size-8 sm:size-9"
          onClick={onPrev}
          aria-label="Poprzedni zakres"
        >
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday}>
          Dziś
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8 sm:size-9"
          onClick={onNext}
          aria-label="Następny zakres"
        >
          <ChevronRight />
        </Button>
        <h2 className="ml-1 line-clamp-2 min-w-0 flex-1 text-sm leading-tight font-semibold capitalize sm:text-lg">
          {formatRangeHeading(view, dateKeys, anchorDate)}
        </h2>
        <div className="flex shrink-0 gap-1.5 lg:hidden">
          <Button size="icon" className="size-8" onClick={onNewReservation} aria-label="Nowa rezerwacja">
            <Plus />
          </Button>
          <Button size="icon" variant="outline" className="size-8" onClick={onAddShift} aria-label="Dodaj zmianę">
            <UserPlus />
          </Button>
        </div>
      </div>

      {/* Row 2 (mobile/tablet) or right side (desktop): view switcher, layers, full-label actions. */}
      <div className="flex flex-wrap items-center gap-2 lg:gap-4">
        <div className="hidden gap-2 lg:flex">
          <Button size="sm" onClick={onNewReservation}>
            <Plus className="h-4 w-4" />
            Nowa rezerwacja
          </Button>
          <Button size="sm" variant="outline" onClick={onAddShift}>
            <Plus className="h-4 w-4" />
            Dodaj zmianę
          </Button>
        </div>

        <div className="flex gap-1 sm:gap-2" role="group" aria-label="Widok kalendarza">
          {VIEWS.map(({ id, label }) => (
            <Button
              key={id}
              size="sm"
              className="px-2.5 sm:px-3"
              variant={view === id ? "default" : "outline"}
              aria-pressed={view === id}
              onClick={() => onViewChange(id)}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Phones: layers collapse into a popover to keep the toolbar to two rows. */}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="ml-auto sm:hidden" aria-label="Warstwy kalendarza">
              <Layers className="h-4 w-4" />
              Warstwy
              {hiddenLayers > 0 ? (
                <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold">−{hiddenLayers}</span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-3">
            <LayerToggles
              idPrefix="calendar-layer-popover"
              layers={layers}
              visibility={visibility}
              onToggleLayer={onToggleLayer}
              className="flex-col items-start"
            />
          </PopoverContent>
        </Popover>

        <LayerToggles
          idPrefix="calendar-layer"
          layers={layers}
          visibility={visibility}
          onToggleLayer={onToggleLayer}
          className="hidden sm:flex"
        />
      </div>
    </div>
  );
}

function LayerToggles({
  idPrefix,
  layers,
  visibility,
  onToggleLayer,
  className,
}: {
  idPrefix: string;
  layers: typeof LAYERS;
  visibility: CalendarVisibility;
  onToggleLayer: (layer: keyof CalendarVisibility) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)} role="group" aria-label="Widoczność warstw">
      {layers.map(({ id, label, swatch }) => (
        <Label key={id} htmlFor={`${idPrefix}-${id}`} className="cursor-pointer font-normal">
          <Checkbox id={`${idPrefix}-${id}`} checked={visibility[id]} onCheckedChange={() => onToggleLayer(id)} />
          <span className={`size-2.5 rounded-full ${swatch}`} aria-hidden="true" />
          {label}
        </Label>
      ))}
    </div>
  );
}
