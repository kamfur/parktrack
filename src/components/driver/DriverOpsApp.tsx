import { useState, type ReactNode } from "react";
import type { ReservationDto } from "@/types";
import { useDriverOps, type DriverTab } from "@/hooks/useDriverOps";
import { DriverReservationRow } from "@/components/driver/DriverReservationRow";
import { DriverArrivalDialog } from "@/components/driver/DriverArrivalDialog";
import { DriverDepartureDialog } from "@/components/driver/DriverDepartureDialog";
import { DriverNewReservationDialog } from "@/components/driver/DriverNewReservationDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

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
    createReservation,
  } = useDriverOps();

  const [arrivalTarget, setArrivalTarget] = useState<ReservationDto | null>(null);
  const [departureTarget, setDepartureTarget] = useState<ReservationDto | null>(null);
  const [newReservationOpen, setNewReservationOpen] = useState(false);

  const opsView = tab !== "occupancy";

  const renderTabButton = (item: { id: DriverTab; label: string }, active: boolean) => (
    <Button
      key={item.id}
      type="button"
      role="tab"
      aria-selected={active}
      variant={active ? "default" : "outline"}
      className="min-h-11 px-2 text-sm"
      onClick={() => setTab(item.id)}
    >
      {item.label}
    </Button>
  );

  return (
    <div className="space-y-4">
      {/* Mobile: three tabs. Desktop: arrivals and departures share one split view. */}
      <div className="grid grid-cols-3 gap-2 lg:hidden" role="tablist" aria-label="Widoki operacji">
        {TABS.map((item) => renderTabButton(item, tab === item.id))}
      </div>
      <div className="hidden grid-cols-2 gap-2 lg:grid" role="tablist" aria-label="Widoki operacji">
        {renderTabButton({ id: "arrivals", label: "Przyjazdy i wyjazdy" }, opsView)}
        {renderTabButton({ id: "occupancy", label: "Parking" }, !opsView)}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {tab === "arrivals" ? (
            <span className="lg:hidden">{`${arrivals.length} do obsługi · ${handledArrivals.length} obsłużonych`}</span>
          ) : null}
          {tab === "departures" ? (
            <span className="lg:hidden">{`${departures.length} do obsługi · ${handledDepartures.length} obsłużonych`}</span>
          ) : null}
          {tab === "occupancy" ? `${occupancy.length} na parkingu` : null}
        </p>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => void refetch()}>
            Odśwież
          </Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setNewReservationOpen(true)}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            Rezerwacja
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {opsView ? (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <DriverListColumn
            title="Przyjazdy"
            className={tab === "arrivals" ? undefined : "hidden lg:block"}
            pending={arrivals}
            handled={handledArrivals}
            isLoading={isLoading}
            renderPending={(reservation) => (
              <DriverReservationRow
                reservation={reservation}
                mode="arrival"
                actionLabel="Przyjęcie"
                disabled={isProcessing}
                onOpen={() => setArrivalTarget(reservation)}
              />
            )}
            renderHandled={(reservation) => <DriverReservationRow reservation={reservation} mode="arrival" handled />}
          />
          <DriverListColumn
            title="Wyjazdy"
            className={tab === "departures" ? undefined : "hidden lg:block"}
            pending={departures}
            handled={handledDepartures}
            isLoading={isLoading}
            renderPending={(reservation) => (
              <DriverReservationRow
                reservation={reservation}
                mode="departure"
                actionLabel="Wydanie"
                disabled={isProcessing}
                onOpen={() => setDepartureTarget(reservation)}
              />
            )}
            renderHandled={(reservation) => <DriverReservationRow reservation={reservation} mode="departure" handled />}
          />
        </div>
      ) : (
        <DriverListColumn
          pending={occupancy}
          handled={[]}
          isLoading={isLoading}
          renderPending={(reservation) => <DriverReservationRow reservation={reservation} mode="occupancy" />}
        />
      )}

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
      <DriverNewReservationDialog
        open={newReservationOpen}
        onOpenChange={setNewReservationOpen}
        onSubmit={createReservation}
        isProcessing={isProcessing}
      />
    </div>
  );
}

interface DriverListColumnProps<T extends ReservationDto> {
  /** Column heading, shown on desktop where both lists sit side by side. */
  title?: string;
  className?: string;
  pending: T[];
  handled: T[];
  isLoading: boolean;
  renderPending: (reservation: T) => ReactNode;
  renderHandled?: (reservation: T) => ReactNode;
}

function DriverListColumn<T extends ReservationDto>({
  title,
  className,
  pending,
  handled,
  isLoading,
  renderPending,
  renderHandled,
}: DriverListColumnProps<T>) {
  const empty = pending.length === 0 && handled.length === 0;

  return (
    <section className={cn("space-y-3", className)} aria-label={title}>
      {title ? (
        <div className="hidden items-baseline justify-between gap-2 border-b pb-2 lg:flex">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {pending.length} do obsługi · {handled.length} obsłużonych
          </p>
        </div>
      ) : null}

      {isLoading && empty ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : null}

      {!isLoading && empty ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Brak pozycji w tym widoku.
        </p>
      ) : null}

      {pending.length > 0 ? (
        <ul className="space-y-3">
          {pending.map((reservation) => (
            <li key={reservation.id}>{renderPending(reservation)}</li>
          ))}
        </ul>
      ) : null}

      {!isLoading && renderHandled && pending.length === 0 && handled.length > 0 ? (
        <p className="text-sm text-muted-foreground">Brak oczekujących.</p>
      ) : null}

      {renderHandled && handled.length > 0 ? (
        <section className="space-y-3" aria-label="Obsłużone">
          <div>
            <h3 className="text-sm font-medium">Obsłużone</h3>
            <p className="text-xs text-muted-foreground">Dzisiaj oraz z ostatnich 12 godzin</p>
          </div>
          <ul className="space-y-3">
            {handled.map((reservation) => (
              <li key={reservation.id}>{renderHandled(reservation)}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
