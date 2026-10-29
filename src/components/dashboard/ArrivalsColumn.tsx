import type { DepartureListItem, ReservationDto } from "@/types";
import { HandledSection } from "./HandledSection";
import { ReservationCard } from "./ReservationCard";
import { EmptyState } from "@/components/common/EmptyState";
import { Calendar, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ArrivalsColumnProps {
  arrivals: ReservationDto[];
  /** Auta już obsłużone (dziś lub w ostatnich 12h) — zwijana sekcja pod listą. */
  handled?: DepartureListItem[];
  onCheckIn: (reservation: ReservationDto) => void;
  onCancel: (reservation: ReservationDto) => void;
  /** Client already on site without a reservation — create it and accept the arrival at once. */
  onAddWalkIn?: () => void;
  isLoading?: boolean;
}

/**
 * Kolumna przyjazdów: dzień bieżący (Warsaw) oraz zaległe, jeszcze nieprzyjęte.
 */
export function ArrivalsColumn({
  arrivals,
  handled = [],
  onCheckIn,
  onCancel,
  onAddWalkIn,
  isLoading = false,
}: ArrivalsColumnProps) {
  const addButton = onAddWalkIn ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onAddWalkIn}
      disabled={isLoading}
      title="Klient jest już na miejscu, a nie ma go na liście przyjazdów"
    >
      <UserPlus className="h-4 w-4" aria-hidden="true" />
      Przyjazd bez rezerwacji
    </Button>
  ) : null;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4 pb-4 border-b">
          <h2 className="text-2xl font-bold">Przyjazdy</h2>
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

  if (arrivals.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4 pb-4 border-b">
          <h2 className="text-2xl font-bold">Przyjazdy</h2>
          <div className="flex items-center gap-2">
            {addButton}
            <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">0</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          <EmptyState
            icon={Calendar}
            title="Brak przyjazdów do obsługi"
            description="Nie ma przyjazdów na dziś ani zaległych, które czekają na przyjęcie"
          />
          <HandledSection items={handled} mode="arrival" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 pb-4 border-b">
        <div>
          <h2 className="text-2xl font-bold" id="arrivals-heading">
            Przyjazdy
          </h2>
          <p className="text-sm text-muted-foreground">Dziś i zaległe</p>
        </div>
        <div className="flex items-center gap-2">
          {addButton}
          <span
            className="text-sm font-medium text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full"
            aria-label={`${arrivals.length} ${arrivals.length === 1 ? "przyjazd" : "przyjazdów"}`}
          >
            {arrivals.length}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        <div className="space-y-3" role="list" aria-labelledby="arrivals-heading">
          {arrivals.map((arrival) => (
            <div key={arrival.id} role="listitem">
              <ReservationCard reservation={arrival} actionType="check-in" onAction={onCheckIn} onCancel={onCancel} />
            </div>
          ))}
        </div>
        <HandledSection items={handled} mode="arrival" />
      </div>
    </div>
  );
}
