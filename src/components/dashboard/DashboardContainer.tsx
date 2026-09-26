import { useState } from "react";
import type { ReservationDto } from "@/types";
import { useDashboard } from "@/hooks/useDashboard";
import { MetricsSection } from "./MetricsSection";
import { TodayView } from "./TodayView";
import { ChangeReturnDateDialog } from "./ChangeReturnDateDialog";
import { LegacyDepartureDialog } from "./LegacyDepartureDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { CancelDialogPlaceholder } from "@/components/reservations/details/CancelDialogPlaceholder";
import { DriverArrivalDialog } from "@/components/driver/DriverArrivalDialog";
import { DriverDepartureDialog } from "@/components/driver/DriverDepartureDialog";
import { toast } from "sonner";

export function DashboardContainer() {
  const {
    data,
    isLoading,
    error,
    isProcessing,
    refetch,
    handleCheckIn,
    handleCheckOut,
    handleCancel,
    handleChangeReturnDate,
    handleCreateLegacyDeparture,
    period,
    setPeriod,
  } = useDashboard();
  const [cancelTarget, setCancelTarget] = useState<ReservationDto | null>(null);
  const [returnDateTarget, setReturnDateTarget] = useState<ReservationDto | null>(null);
  const [arrivalTarget, setArrivalTarget] = useState<ReservationDto | null>(null);
  const [departureTarget, setDepartureTarget] = useState<ReservationDto | null>(null);
  const [isLegacyDepartureOpen, setLegacyDepartureOpen] = useState(false);

  const onConfirmCancel = async (reason?: string) => {
    if (!cancelTarget) return;
    try {
      await handleCancel(cancelTarget, reason);
      setCancelTarget(null);
      toast.success("Rezerwacja anulowana");
    } catch {
      toast.error("Nie udało się anulować rezerwacji. Spróbuj ponownie.");
    }
  };

  const onConfirmReturnDate = async (plannedCheckOut: string) => {
    if (!returnDateTarget) return;
    try {
      await handleChangeReturnDate(returnDateTarget.id, plannedCheckOut);
      setReturnDateTarget(null);
      toast.success("Data powrotu zaktualizowana");
    } catch {
      toast.error("Nie udało się zmienić daty powrotu. Spróbuj ponownie.");
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
        <TodayView
          arrivals={[]}
          departures={[]}
          onCheckIn={setArrivalTarget}
          onCheckOut={setDepartureTarget}
          onCancel={setCancelTarget}
          onChangeReturnDate={setReturnDateTarget}
          isLoading={true}
        />
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
        onCheckIn={setArrivalTarget}
        onCheckOut={setDepartureTarget}
        onCancel={setCancelTarget}
        onChangeReturnDate={setReturnDateTarget}
        onAddLegacyDeparture={() => setLegacyDepartureOpen(true)}
        isLoading={isProcessing}
      />
      <DriverArrivalDialog
        reservation={arrivalTarget}
        open={Boolean(arrivalTarget)}
        onOpenChange={(open) => {
          if (!open) setArrivalTarget(null);
        }}
        isProcessing={isProcessing}
        onSubmit={async (id, body) => {
          await handleCheckIn(id, body);
          toast.success("Przyjazd potwierdzony");
        }}
      />
      <DriverDepartureDialog
        reservation={departureTarget}
        open={Boolean(departureTarget)}
        onOpenChange={(open) => {
          if (!open) setDepartureTarget(null);
        }}
        isProcessing={isProcessing}
        onSubmit={async (id, body) => {
          await handleCheckOut(id, body);
          toast.success("Wyjazd zakończony");
        }}
      />
      <CancelDialogPlaceholder
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={onConfirmCancel}
        isLoading={isProcessing}
      />
      <LegacyDepartureDialog
        isOpen={isLegacyDepartureOpen}
        onClose={() => setLegacyDepartureOpen(false)}
        onConfirm={async (command) => {
          await handleCreateLegacyDeparture(command);
          setLegacyDepartureOpen(false);
          toast.success("Wyjazd dodany");
        }}
        isLoading={isProcessing}
      />
      <ChangeReturnDateDialog
        reservation={returnDateTarget}
        isOpen={Boolean(returnDateTarget)}
        onClose={() => setReturnDateTarget(null)}
        onConfirm={onConfirmReturnDate}
        isLoading={isProcessing}
      />
    </div>
  );
}
