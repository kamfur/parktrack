import { useState, type ReactNode } from "react";
import type { ReservationDto } from "@/types";
import { useDriverOps, type DriverTab } from "@/hooks/useDriverOps";
import { DriverReservationRow } from "@/components/driver/DriverReservationRow";
import { DriverArrivalDialog } from "@/components/driver/DriverArrivalDialog";
import { DriverDepartureDialog } from "@/components/driver/DriverDepartureDialog";
import { DriverNewReservationDialog } from "@/components/driver/DriverNewReservationDialog";
import { matchesDriverSearch } from "@/lib/driver/display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  LogIn,
  LogOut,
  ParkingSquare,
  Plus,
  RefreshCw,
  Search,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";

const TABS: { id: DriverTab; label: string; icon: LucideIcon }[] = [
  { id: "arrivals", label: "Przyjazdy", icon: LogIn },
  { id: "departures", label: "Wyjazdy", icon: LogOut },
  { id: "occupancy", label: "Parking", icon: ParkingSquare },
];

function formatClock(date: Date): string {
  return date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

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
    lastUpdated,
    refetch,
    confirmArrival,
    completeDeparture,
    createReservation,
    createWalkInArrival,
  } = useDriverOps();

  const [arrivalTarget, setArrivalTarget] = useState<ReservationDto | null>(null);
  const [departureTarget, setDepartureTarget] = useState<ReservationDto | null>(null);
  const [newReservationOpen, setNewReservationOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [query, setQuery] = useState("");

  const opsView = tab !== "occupancy";
  const filter = <T extends ReservationDto>(items: T[]) => items.filter((r) => matchesDriverSearch(r, query));
  const pendingCounts: Record<DriverTab, number> = {
    arrivals: arrivals.length,
    departures: departures.length,
    occupancy: occupancy.length,
  };

  const selectTab = (next: DriverTab) => {
    setTab(next);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="space-y-4">
      {/* Desktop: arrivals and departures share one split view; mobile uses the bottom bar. */}
      <div className="hidden grid-cols-2 gap-2 lg:grid" role="tablist" aria-label="Widoki operacji">
        {[
          { id: "arrivals" as const, label: "Przyjazdy i wyjazdy", active: opsView },
          { id: "occupancy" as const, label: "Parking", active: !opsView },
        ].map((item) => (
          <Button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.active}
            variant={item.active ? "default" : "outline"}
            className="min-h-11 px-2 text-sm"
            onClick={() => selectTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            placeholder="Nazwisko, rejestracja, tel."
            aria-label="Szukaj rezerwacji"
            className="min-h-11 pl-9 pr-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button
              type="button"
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              aria-label="Wyczyść wyszukiwanie"
              onClick={() => setQuery("")}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label="Odśwież"
          onClick={() => void refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="hidden min-h-11 shrink-0 lg:inline-flex"
          title="Rezerwacja na przyszły termin — klient jeszcze nie przyjechał"
          onClick={() => setNewReservationOpen(true)}
        >
          <Plus className="mr-1 h-4 w-4" aria-hidden />
          Rezerwacja
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {tab === "arrivals" ? (
          <span className="lg:hidden">{`${arrivals.length} do obsługi · ${handledArrivals.length} obsłużonych · `}</span>
        ) : null}
        {tab === "departures" ? (
          <span className="lg:hidden">{`${departures.length} do obsługi · ${handledDepartures.length} obsłużonych · `}</span>
        ) : null}
        {tab === "occupancy" ? `${occupancy.length} na parkingu · ` : null}
        {lastUpdated ? `aktualizacja ${formatClock(lastUpdated)}` : "wczytywanie…"}
      </p>

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
            pending={filter(arrivals)}
            handled={filter(handledArrivals)}
            isLoading={isLoading}
            query={query}
            intro={
              <div className="flex gap-2">
                <WalkInArrivalButton disabled={isProcessing} onAdd={() => setWalkInOpen(true)} />
                {/* Mobile only — desktop has the "Rezerwacja" button next to the search. */}
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-11 flex-1 whitespace-normal py-2 lg:hidden"
                  title="Rezerwacja na przyszły termin — klient jeszcze nie przyjechał"
                  onClick={() => setNewReservationOpen(true)}
                >
                  <Plus className="mr-1 h-4 w-4" aria-hidden />
                  Nowa rezerwacja
                </Button>
              </div>
            }
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
            pending={filter(departures)}
            handled={filter(handledDepartures)}
            isLoading={isLoading}
            query={query}
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
          pending={filter(occupancy)}
          handled={[]}
          isLoading={isLoading}
          query={query}
          renderPending={(reservation) => <DriverReservationRow reservation={reservation} mode="occupancy" />}
        />
      )}

      {/* Mobile: room for the fixed bottom bar, so the last rows (e.g. "Obsłużone") stay reachable. */}
      <div aria-hidden className="lg:hidden" style={{ height: "calc(5rem + env(safe-area-inset-bottom))" }} />

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Widoki operacji"
      >
        <div className="mx-auto grid max-w-lg grid-cols-3" role="tablist">
          {TABS.map((item) => {
            const active = tab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={cn(
                  "relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}
                onClick={() => selectTab(item.id)}
              >
                {active ? (
                  <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary" aria-hidden />
                ) : null}
                <span className="relative">
                  <Icon className="h-5 w-5" aria-hidden />
                  {pendingCounts[item.id] > 0 ? (
                    <span className="absolute -right-3 -top-2 min-w-5 rounded-full bg-primary px-1 text-center text-[10px] leading-5 text-primary-foreground">
                      {pendingCounts[item.id]}
                    </span>
                  ) : null}
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

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
      <DriverArrivalDialog
        mode="walk-in"
        open={walkInOpen}
        onOpenChange={setWalkInOpen}
        onSubmit={createWalkInArrival}
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
  /** Active search text — changes the empty-state message. */
  query: string;
  /** Shown above the list (e.g. the walk-in arrival entry point). */
  intro?: ReactNode;
  renderPending: (reservation: T) => ReactNode;
  renderHandled?: (reservation: T) => ReactNode;
}

function DriverListColumn<T extends ReservationDto>({
  title,
  className,
  pending,
  handled,
  isLoading,
  query,
  intro,
  renderPending,
  renderHandled,
}: DriverListColumnProps<T>) {
  // Handled stays collapsed on mobile to keep pending work on screen; always open on desktop.
  const [handledOpen, setHandledOpen] = useState(false);
  const empty = pending.length === 0 && handled.length === 0;
  const searching = query.trim() !== "";

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

      {intro}

      {isLoading && empty && !searching ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : null}

      {!isLoading && empty ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {searching ? `Brak wyników dla „${query.trim()}”.` : "Brak pozycji w tym widoku."}
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
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between rounded-md border px-3 text-left lg:pointer-events-none lg:border-0 lg:px-0"
            aria-expanded={handledOpen}
            onClick={() => setHandledOpen((open) => !open)}
          >
            <span>
              <span className="block text-sm font-medium">Obsłużone ({handled.length})</span>
              <span className="block text-xs text-muted-foreground">Dzisiaj oraz z ostatnich 12 godzin</span>
            </span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform lg:hidden", handledOpen && "rotate-180")}
              aria-hidden
            />
          </button>
          <ul className={cn("space-y-3", !handledOpen && !searching && "hidden lg:block")}>
            {handled.map((reservation) => (
              <li key={reservation.id}>{renderHandled(reservation)}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
/** Entry point for a client who arrived without a reservation. */
function WalkInArrivalButton({ onAdd, disabled }: { onAdd: () => void; disabled: boolean }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto min-h-11 flex-1 whitespace-normal py-2"
      disabled={disabled}
      title="Klient jest już na miejscu, a nie ma go na liście przyjazdów"
      onClick={onAdd}
    >
      <UserPlus className="mr-1 h-4 w-4" aria-hidden />
      Przyjazd bez rezerwacji
    </Button>
  );
}
