import type { ReservationDto } from "@/types";
import { ArrivalsColumn } from "./ArrivalsColumn";
import { DeparturesColumn } from "./DeparturesColumn";

interface TodayViewProps {
  arrivals: ReservationDto[];
  departures: ReservationDto[];
  onCheckIn: (reservation: ReservationDto) => void;
  onCheckOut: (reservation: ReservationDto) => void;
  onCancel: (reservation: ReservationDto) => void;
  onChangeReturnDate: (reservation: ReservationDto) => void;
  onAddLegacyDeparture?: () => void;
  isLoading?: boolean;
}

/**
 * Kontener dla dwóch kolumn zawierających listy przyjazdów i wyjazdów.
 * Odpowiada za layout i responsive design (2 kolumny desktop, 1 kolumna mobile).
 */
export function TodayView({
  arrivals,
  departures,
  onCheckIn,
  onCheckOut,
  onCancel,
  onChangeReturnDate,
  onAddLegacyDeparture,
  isLoading = false,
}: TodayViewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-20rem)]">
      <div className="border rounded-lg p-6 bg-card">
        <ArrivalsColumn arrivals={arrivals} onCheckIn={onCheckIn} onCancel={onCancel} isLoading={isLoading} />
      </div>
      <div className="border rounded-lg p-6 bg-card">
        <DeparturesColumn
          departures={departures}
          onCheckOut={onCheckOut}
          onChangeReturnDate={onChangeReturnDate}
          onAddLegacyDeparture={onAddLegacyDeparture}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
