import { CalendarClock } from "lucide-react";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarToolbar } from "./CalendarToolbar";
import { ErrorState } from "@/components/common/ErrorState";
import { useParkingCalendar } from "@/hooks/useParkingCalendar";

export function CalendarView() {
  const calendar = useParkingCalendar();

  if (calendar.error && !calendar.isLoading) {
    return (
      <ErrorState
        title="Nie udało się załadować kalendarza"
        message="Wystąpił błąd podczas pobierania przyjazdów, wyjazdów lub zmian. Sprawdź połączenie i spróbuj ponownie."
        onRetry={calendar.refetch}
      />
    );
  }

  const isEmpty = !calendar.isLoading && calendar.events.length === 0 && calendar.shifts.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <CalendarToolbar
        view={calendar.view}
        dateKeys={calendar.dateKeys}
        visibility={calendar.visibility}
        onViewChange={calendar.setView}
        onToggleLayer={calendar.toggleLayer}
        onPrev={calendar.goPrev}
        onNext={calendar.goNext}
        onToday={calendar.goToday}
      />

      {isEmpty ? (
        <div className="flex items-start gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="font-medium">Brak wydarzeń w tym zakresie</p>
            <p className="text-muted-foreground">
              Nie ma zaplanowanych przyjazdów, wyjazdów ani zmian. Zmień datę albo włącz ukryte warstwy.
            </p>
          </div>
        </div>
      ) : null}

      <CalendarGrid
        dateKeys={calendar.dateKeys}
        events={calendar.events}
        shifts={calendar.shifts}
        drivers={calendar.drivers}
        isLoading={calendar.isLoading}
      />
    </div>
  );
}
