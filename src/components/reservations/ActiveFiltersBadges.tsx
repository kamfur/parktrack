import { X } from "lucide-react";
import type { ReservationsListFilters } from "../../types";
import { getStatusLabel, getSourceLabel } from "../../lib/utils/reservation.formatters";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { hasActiveFilters, countActiveFilters } from "../../lib/utils/url-params";

export interface ActiveFiltersBadgesProps {
  /** Aktywne filtry */
  filters: ReservationsListFilters;
  /** Callback wywoływany przy usunięciu pojedynczego filtra */
  onRemoveFilter: (filterKey: keyof ReservationsListFilters, value?: string) => void;
  /** Callback wywoływany przy czyszczeniu wszystkich filtrów */
  onClearAll: () => void;
}

/**
 * Komponent wyświetlający aktywne filtry jako removable badges
 */
export function ActiveFiltersBadges({ filters, onRemoveFilter, onClearAll }: ActiveFiltersBadgesProps) {
  // Jeśli brak aktywnych filtrów, nie renderuj nic
  if (!hasActiveFilters(filters)) {
    return null;
  }

  const activeFiltersCount = countActiveFilters(filters);

  // Formatuj zakres dat
  const formatDateRange = () => {
    if (!filters.dateRange.from && !filters.dateRange.to) {
      return null;
    }

    const formatDate = (date: Date) => {
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      return `${day}.${month}`;
    };

    if (filters.dateRange.from && filters.dateRange.to) {
      return `${formatDate(filters.dateRange.from)} - ${formatDate(filters.dateRange.to)}`;
    } else if (filters.dateRange.from) {
      return `Od ${formatDate(filters.dateRange.from)}`;
    } else if (filters.dateRange.to) {
      return `Do ${formatDate(filters.dateRange.to)}`;
    }

    return null;
  };

  const dateRangeLabel = formatDateRange();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Badge dla wyszukiwania */}
      {filters.search && (
        <Badge variant="secondary" className="gap-1">
          <span className="text-xs">
            Szukaj: <span className="font-semibold">{filters.search}</span>
          </span>
          <button
            type="button"
            onClick={() => onRemoveFilter("search")}
            className="ml-1 rounded-full hover:bg-muted-foreground/20"
            aria-label="Usuń filtr wyszukiwania"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}

      {/* Badges dla statusów */}
      {filters.statuses.map((status) => (
        <Badge key={status} variant="secondary" className="gap-1">
          <span className="text-xs">
            Status: <span className="font-semibold">{getStatusLabel(status)}</span>
          </span>
          <button
            type="button"
            onClick={() => onRemoveFilter("statuses", status)}
            className="ml-1 rounded-full hover:bg-muted-foreground/20"
            aria-label={`Usuń filtr statusu ${getStatusLabel(status)}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {/* Badge dla źródła */}
      {filters.source && (
        <Badge variant="secondary" className="gap-1">
          <span className="text-xs">
            Źródło: <span className="font-semibold">{getSourceLabel(filters.source)}</span>
          </span>
          <button
            type="button"
            onClick={() => onRemoveFilter("source")}
            className="ml-1 rounded-full hover:bg-muted-foreground/20"
            aria-label="Usuń filtr źródła"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}

      {/* Badge dla zakresu dat */}
      {dateRangeLabel && (
        <Badge variant="secondary" className="gap-1">
          <span className="text-xs">
            Daty: <span className="font-semibold">{dateRangeLabel}</span>
          </span>
          <button
            type="button"
            onClick={() => onRemoveFilter("dateRange")}
            className="ml-1 rounded-full hover:bg-muted-foreground/20"
            aria-label="Usuń filtr dat"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}

      {/* Przycisk "Wyczyść wszystkie" jeśli więcej niż jeden filtr */}
      {activeFiltersCount > 1 && (
        <Button variant="ghost" size="sm" onClick={onClearAll} className="h-7 px-2 text-xs">
          Wyczyść wszystkie ({activeFiltersCount})
        </Button>
      )}
    </div>
  );
}
