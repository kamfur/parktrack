import { useState } from "react";
import type { DepartureListItem } from "@/types";
import { DriverReservationRow } from "@/components/driver/DriverReservationRow";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface HandledSectionProps {
  /** Przyjęte (arrival) lub wydane (departure) auta z okna "obsłużonych". */
  items: DepartureListItem[];
  mode: "arrival" | "departure";
}

/**
 * Zwijana lista aut już obsłużonych — ten sam widok co "Obsłużone" w panelu kierowcy.
 * Domyślnie zwinięta, żeby oczekujące pozycje zostały na ekranie.
 */
export function HandledSection({ items, mode }: HandledSectionProps) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <section className="space-y-3 pt-2" aria-label={mode === "arrival" ? "Przyjazdy obsłużone" : "Wyjazdy obsłużone"}>
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between rounded-md border px-3 text-left hover:bg-muted/50"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <span className="block text-sm font-medium">Obsłużone ({items.length})</span>
          <span className="block text-xs text-muted-foreground">Dzisiaj oraz z ostatnich 12 godzin</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <ul className="space-y-3">
          {items.map((reservation) => (
            <li key={reservation.id}>
              <DriverReservationRow reservation={reservation} mode={mode} handled />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
