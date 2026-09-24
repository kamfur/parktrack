import type { ReservationDto } from "@/types";
import { ReservationCard } from "./ReservationCard";
import { EmptyState } from "@/components/common/EmptyState";
import { Calendar } from "lucide-react";

interface ArrivalsColumnProps {
  arrivals: ReservationDto[];
  onCheckIn: (reservation: ReservationDto) => void;
  onCancel: (reservation: ReservationDto) => void;
  isLoading?: boolean;
}

/**
 * Kolumna przyjazdów: dzień bieżący (Warsaw) oraz zaległe, jeszcze nieprzyjęte.
 */
export function ArrivalsColumn({ arrivals, onCheckIn, onCancel, isLoading = false }: ArrivalsColumnProps) {
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
          <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">0</span>
        </div>
        <EmptyState
          icon={Calendar}
          title="Brak przyjazdów do obsługi"
          description="Nie ma przyjazdów na dziś ani zaległych, które czekają na przyjęcie"
        />
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
        <span
          className="text-sm font-medium text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full"
          aria-label={`${arrivals.length} ${arrivals.length === 1 ? "przyjazd" : "przyjazdów"}`}
        >
          {arrivals.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-2" role="list" aria-labelledby="arrivals-heading">
        {arrivals.map((arrival) => (
          <div key={arrival.id} role="listitem">
            <ReservationCard reservation={arrival} actionType="check-in" onAction={onCheckIn} onCancel={onCancel} />
          </div>
        ))}
      </div>
    </div>
  );
}
