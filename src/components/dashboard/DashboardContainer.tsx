import { useDashboard } from "@/hooks/useDashboard";
import { MetricsSection } from "./MetricsSection";
import { TodayView } from "./TodayView";
import { ErrorState } from "@/components/common/ErrorState";
import { toast } from "sonner";

export function DashboardContainer() {
  const { data, isLoading, error, isProcessing, refetch, handleCheckIn, handleCheckOut, period, setPeriod } =
    useDashboard();

  const onCheckIn = async (reservationId: string) => {
    try {
      await handleCheckIn(reservationId);
      toast.success("Klient zameldowany pomyślnie");
    } catch {
      toast.error("Nie udało się wykonać check-in. Spróbuj ponownie.");
    }
  };

  const onCheckOut = async (reservationId: string) => {
    try {
      await handleCheckOut(reservationId);
      toast.success("Klient wymeldowany pomyślnie");
    } catch {
      toast.error("Nie udało się wykonać check-out. Spróbuj ponownie.");
    }
  };

  if (error && !isLoading) {
    return (
      <ErrorState
        title="Nie udało się załadować danych dashboardu"
        message="Wystąpił błąd podczas pobierania danych. Sprawdź połączenie internetowe i spróbuj ponownie."
        onRetry={refetch}
      />
    );
  }

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <MetricsSection stats={null} period={period} onPeriodChange={setPeriod} isLoading={true} />
        <TodayView arrivals={[]} departures={[]} onCheckIn={onCheckIn} onCheckOut={onCheckOut} isLoading={true} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <MetricsSection stats={data.stats} period={period} onPeriodChange={setPeriod} isLoading={isLoading} />
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
