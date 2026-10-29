import type { DepartureListItem, ReservationDto } from "@/types";
import { HandledSection } from "./HandledSection";
import { ReservationCard } from "./ReservationCard";
import { EmptyState } from "@/components/common/EmptyState";
import { Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeparturesColumnProps {
  departures: ReservationDto[];
  /** Auta już obsłużone (dziś lub w ostatnich 12h) — zwijana sekcja pod listą. */
  handled?: DepartureListItem[];
  onCheckOut: (reservation: ReservationDto) => void;
  onChangeReturnDate: (reservation: ReservationDto) => void;
  /** TYMCZASOWE: dodanie wyjazdu dla auta stojącego przed wdrożeniem systemu. */
  onAddLegacyDeparture?: () => void;
  isLoading?: boolean;
}

/**
 * Kolumna wyjazdów: dzień bieżący (Warsaw) oraz opóźnione powroty bez check-out.
 */
export function DeparturesColumn({
  departures,
  handled = [],
  onCheckOut,
  onChangeReturnDate,
  onAddLegacyDeparture,
  isLoading = false,
}: DeparturesColumnProps) {
  const addButton = onAddLegacyDeparture ? (
    <Button type="button" variant="outline" size="sm" onClick={onAddLegacyDeparture} disabled={isLoading}>
      <Plus className="h-4 w-4" aria-hidden="true" />
      Dodaj wyjazd
    </Button>
  ) : null;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4 pb-4 border-b">
          <h2 className="text-2xl font-bold">Wyjazdy</h2>
          <div className="h-8 w-12 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
              <div className="space-y-3">
                <div className="h-6 w-32 bg-gray-200 rounded" />
                <div className="space-y-2">
                  <div className="h-4 w-full bg-gray-200 rounded" />
                  <div className="h-4 w-3/4 bg-gray-200 rounded" />
                </div>
                <div className="h-10 w-full bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (departures.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4 pb-4 border-b">
          <h2 className="text-2xl font-bold">Wyjazdy</h2>
          <div className="flex items-center gap-2">
            {addButton}
            <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">0</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          <EmptyState
            icon={Calendar}
            title="Brak wyjazdów do obsługi"
            description="Nie ma powrotów na dziś ani opóźnionych, które czekają na wydanie"
          />
          <HandledSection items={handled} mode="departure" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 pb-4 border-b">
        <div>
          <h2 className="text-2xl font-bold" id="departures-heading">
            Wyjazdy
          </h2>
          <p className="text-sm text-muted-foreground">Dziś i opóźnione</p>
        </div>
        <div className="flex items-center gap-2">
          {addButton}
          <span
            className="text-sm font-medium text-rose-700 bg-rose-100 px-3 py-1 rounded-full"
            aria-label={`${departures.length} ${departures.length === 1 ? "wyjazd" : "wyjazdów"}`}
          >
            {departures.length}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        <div className="space-y-3" role="list" aria-labelledby="departures-heading">
          {departures.map((departure) => (
            <div key={departure.id} role="listitem">
              <ReservationCard
                reservation={departure}
                actionType="check-out"
                onAction={onCheckOut}
                onChangeReturnDate={onChangeReturnDate}
              />
            </div>
          ))}
        </div>
        <HandledSection items={handled} mode="departure" />
      </div>
    </div>
  );
}
