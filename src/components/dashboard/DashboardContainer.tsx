import { useDashboard } from "@/hooks/useDashboard";
import { MetricsSection } from "./MetricsSection";
import { TodayView } from "./TodayView";
import { ErrorState } from "@/components/common/ErrorState";
import { toast } from "sonner";

/**
 * Główny kontener React odpowiedzialny za zarządzanie stanem całego dashboardu.
 * Wykorzystuje custom hook useDashboard do zarządzania logiką biznesową.
 */
export function DashboardContainer() {
  const { data, isLoading, error, isProcessing, refetch, handleCheckIn, handleCheckOut } = useDashboard();

  // Wrapper dla handleCheckIn z toast notifications
  const onCheckIn = async (reservationId: string) => {
    try {
      await handleCheckIn(reservationId);
      toast.success("Klient zameldowany pomyślnie");
    } catch {
      toast.error("Nie udało się wykonać check-in. Spróbuj ponownie.");
    }
  };

  // Wrapper dla handleCheckOut z toast notifications
  const onCheckOut = async (reservationId: string) => {
    try {
      await handleCheckOut(reservationId);
      toast.success("Klient wymeldowany pomyślnie");
    } catch {
      toast.error("Nie udało się wykonać check-out. Spróbuj ponownie.");
    }
  };

  // Error state
  if (error && !isLoading) {
    return (
      <ErrorState
        title="Nie udało się załadować danych dashboardu"
        message="Wystąpił błąd podczas pobierania danych. Sprawdź połączenie internetowe i spróbuj ponownie."
        onRetry={refetch}
      />
    );
  }

  // Loading state (initial load)
  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <MetricsSection
          metrics={{
            availableSpots: 0,
            totalReservations: 0,
            plannedArrivals: 0,
            plannedDepartures: 0,
          }}
          isLoading={true}
        />
        <TodayView arrivals={[]} departures={[]} onCheckIn={onCheckIn} onCheckOut={onCheckOut} isLoading={true} />
      </div>
    );
  }

  // Success state - render dashboard with data
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Sekcja metryk */}
      <MetricsSection metrics={data.metrics} isLoading={isLoading} />

      {/* Sekcja list przyjazdów i wyjazdów */}
      <TodayView
        arrivals={data.todaysArrivals}
        departures={data.todaysDepartures}
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
        isLoading={isProcessing}
      />
    </div>
  );
}
