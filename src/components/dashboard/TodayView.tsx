import type { DepartureListItem, ReservationDto } from "@/types";
import { ArrivalsColumn } from "./ArrivalsColumn";
import { DeparturesColumn } from "./DeparturesColumn";

interface TodayViewProps {
  arrivals: ReservationDto[];
  departures: ReservationDto[];
  handledArrivals?: DepartureListItem[];
  handledDepartures?: DepartureListItem[];
  onCheckIn: (reservation: ReservationDto) => void;
  onCheckOut: (reservation: ReservationDto) => void;
  onCancel: (reservation: ReservationDto) => void;
  onChangeReturnDate: (reservation: ReservationDto) => void;
  onAddLegacyDeparture?: () => void;
  onAddWalkIn?: () => void;
  isLoading?: boolean;
}

/**
 * Kontener dla dwóch kolumn zawierających listy przyjazdów i wyjazdów.
 * Odpowiada za layout i responsive design (2 kolumny desktop, 1 kolumna mobile).
 */
export function TodayView({
  arrivals,
  departures,
  handledArrivals = [],
  handledDepartures = [],
  onCheckIn,
  onCheckOut,
  onCancel,
  onChangeReturnDate,
  onAddLegacyDeparture,
  onAddWalkIn,
  isLoading = false,
}: TodayViewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-20rem)]">
      <div className="border rounded-lg p-6 bg-card">
        <ArrivalsColumn
          arrivals={arrivals}
          handled={handledArrivals}
          onCheckIn={onCheckIn}
          onCancel={onCancel}
          onAddWalkIn={onAddWalkIn}
          isLoading={isLoading}
        />
      </div>
      <div className="border rounded-lg p-6 bg-card">
        <DeparturesColumn
          departures={departures}
          handled={handledDepartures}
          onCheckOut={onCheckOut}
          onChangeReturnDate={onChangeReturnDate}
          onAddLegacyDeparture={onAddLegacyDeparture}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
