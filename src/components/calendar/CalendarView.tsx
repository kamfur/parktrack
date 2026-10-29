import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { CalendarToolbar } from "./CalendarToolbar";
import { ShiftDialog, type ShiftDialogState } from "./ShiftDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { ReservationDetailsView } from "@/components/reservations/details";
import { useParkingCalendar } from "@/hooks/useParkingCalendar";

export function CalendarView() {
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [shiftState, setShiftState] = useState<ShiftDialogState | null>(null);
  const isDialogOpen = reservationId !== null || shiftState !== null;
  const calendar = useParkingCalendar({ pauseRefresh: isDialogOpen });
  const pendingRefreshRef = useRef(false);

  const handleReservationUpdated = useCallback(() => {
    pendingRefreshRef.current = true;
  }, []);

  useEffect(() => {
    if (isDialogOpen || !pendingRefreshRef.current) return;
    pendingRefreshRef.current = false;
    void calendar.refetch(true);
  }, [isDialogOpen, calendar.refetch]);

  if (calendar.error && !calendar.isLoading) {
    return (
      <ErrorState
        title="Nie udało się załadować kalendarza"
        message="Wystąpił błąd podczas pobierania przyjazdów, wyjazdów lub zmian. Sprawdź połączenie i spróbuj ponownie."
        onRetry={() => void calendar.refetch()}
      />
    );
  }

  const isEmpty =
    calendar.view !== "month" && !calendar.isLoading && calendar.events.length === 0 && calendar.shifts.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 sm:gap-4">
      <CalendarToolbar
        view={calendar.view}
        dateKeys={calendar.dateKeys}
        anchorDate={calendar.anchorDate}
        visibility={calendar.visibility}
        onViewChange={calendar.setView}
        onToggleLayer={calendar.toggleLayer}
        onPrev={calendar.goPrev}
        onNext={calendar.goNext}
        onToday={calendar.goToday}
        onNewReservation={() => window.dispatchEvent(new CustomEvent("openNewReservationModal"))}
        onAddShift={() => setShiftState({ mode: "create", dateKey: calendar.anchorDate })}
      />

      {isEmpty ? (
        <div className="flex shrink-0 items-start gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm sm:px-4 sm:py-3">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="font-medium">Brak wydarzeń w tym zakresie</p>
            <p className="hidden text-muted-foreground sm:block">
              Nie ma zaplanowanych przyjazdów, wyjazdów ani zmian. Zmień datę albo włącz ukryte warstwy.
            </p>
          </div>
        </div>
      ) : null}

      {calendar.view === "month" ? (
        <CalendarMonthGrid
          dateKeys={calendar.dateKeys}
          anchorDate={calendar.anchorDate}
          days={calendar.monthDays}
          visibility={calendar.visibility}
          isLoading={calendar.isLoading}
          onSelectDay={calendar.openDay}
        />
      ) : (
        <CalendarGrid
          dateKeys={calendar.dateKeys}
          events={calendar.events}
          shifts={calendar.shifts}
          drivers={calendar.drivers}
          isLoading={calendar.isLoading}
          onEventClick={(event) => setReservationId(event.reservationId)}
          onShiftClick={(shift) => setShiftState({ mode: "edit", shift })}
        />
      )}

      {reservationId ? (
        <ReservationDetailsView
          reservationId={reservationId}
          isOpen
          onClose={() => setReservationId(null)}
          onUpdate={handleReservationUpdated}
        />
      ) : null}

      <ShiftDialog
        state={shiftState}
        drivers={calendar.drivers}
        isProcessing={calendar.isMutating}
        onOpenChange={(open) => {
          if (!open) setShiftState(null);
        }}
        onSave={async (command, shiftId) => {
          try {
            await calendar.saveShift(command, shiftId);
            setShiftState(null);
            toast.success(shiftId ? "Zmiana zaktualizowana" : "Zmiana dodana");
          } catch {
            toast.error("Nie udało się zapisać zmiany");
          }
        }}
        onDelete={async (shiftId) => {
          try {
            await calendar.deleteShift(shiftId);
            setShiftState(null);
            toast.success("Zmiana usunięta");
          } catch {
            toast.error("Nie udało się usunąć zmiany");
          }
        }}
      />
    </div>
  );
}
