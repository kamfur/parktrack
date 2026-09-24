import { useState } from "react";
import type { ReservationDto } from "@/types";
import { useDriverOps, type DriverTab } from "@/hooks/useDriverOps";
import { DriverReservationRow } from "@/components/driver/DriverReservationRow";
import { DriverArrivalDialog } from "@/components/driver/DriverArrivalDialog";
import { DriverDepartureDialog } from "@/components/driver/DriverDepartureDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TABS: { id: DriverTab; label: string }[] = [
  { id: "arrivals", label: "Przyjazdy" },
  { id: "departures", label: "Wyjazdy" },
  { id: "occupancy", label: "Parking" },
];

export function DriverOpsApp() {
  const {
    arrivals,
    handledArrivals,
    departures,
    handledDepartures,
    occupancy,
    isLoading,
    error,
    isProcessing,
    tab,
    setTab,
    refetch,
    confirmArrival,
    completeDeparture,
  } = useDriverOps();

  const [arrivalTarget, setArrivalTarget] = useState<ReservationDto | null>(null);
  const [departureTarget, setDepartureTarget] = useState<ReservationDto | null>(null);

  const pending = tab === "arrivals" ? arrivals : tab === "departures" ? departures : occupancy;
  const handled = tab === "arrivals" ? handledArrivals : tab === "departures" ? handledDepartures : [];
  const showHandled = tab !== "occupancy";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Widoki operacji">
        {TABS.map((item) => (
          <Button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            variant={tab === item.id ? "default" : "outline"}
            className={cn("min-h-11 px-2 text-sm")}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {tab === "arrivals" && `${arrivals.length} do obsługi · ${handledArrivals.length} obsłużonych`}
          {tab === "departures" && `${departures.length} do obsługi · ${handledDepartures.length} obsłużonych`}
          {tab === "occupancy" && `${occupancy.length} na parkingu`}
        </p>
        <Button type="button" variant="ghost" className="min-h-11" onClick={() => void refetch()}>
          Odśwież
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading && pending.length === 0 && handled.length === 0 ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : null}

      {!isLoading && pending.length === 0 && handled.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Brak pozycji w tym widoku.
        </p>
      ) : null}

      {pending.length > 0 ? (
        <ul className="space-y-3">
          {pending.map((reservation) => (
            <li key={reservation.id}>
              {tab === "arrivals" ? (
                <DriverReservationRow
                  reservation={reservation}
                  mode="arrival"
                  actionLabel="Przyjęcie"
                  disabled={isProcessing}
                  onOpen={() => setArrivalTarget(reservation)}
                />
              ) : null}
              {tab === "departures" ? (
                <DriverReservationRow
                  reservation={reservation}
                  mode="departure"
                  actionLabel="Wydanie"
                  disabled={isProcessing}
                  onOpen={() => setDepartureTarget(reservation)}
                />
              ) : null}
              {tab === "occupancy" ? <DriverReservationRow reservation={reservation} mode="occupancy" /> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!isLoading && showHandled && pending.length === 0 && handled.length > 0 ? (
        <p className="text-sm text-muted-foreground">Brak oczekujących.</p>
      ) : null}

      {showHandled && handled.length > 0 ? (
        <section className="space-y-3" aria-label="Obsłużone">
          <div>
            <h2 className="text-sm font-medium">Obsłużone</h2>
            <p className="text-xs text-muted-foreground">Dzisiaj oraz z ostatnich 12 godzin</p>
          </div>
          <ul className="space-y-3">
            {handled.map((reservation) => (
              <li key={reservation.id}>
                <DriverReservationRow
                  reservation={reservation}
                  mode={tab === "arrivals" ? "arrival" : "departure"}
                  handled
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <DriverArrivalDialog
        reservation={arrivalTarget}
        open={arrivalTarget !== null}
        onOpenChange={(open) => {
          if (!open) setArrivalTarget(null);
        }}
        onSubmit={confirmArrival}
        isProcessing={isProcessing}
      />
      <DriverDepartureDialog
        reservation={departureTarget}
        open={departureTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDepartureTarget(null);
        }}
        onSubmit={completeDeparture}
        isProcessing={isProcessing}
      />
    </div>
  );
}
