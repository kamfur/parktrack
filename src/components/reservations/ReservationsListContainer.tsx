import { useCallback } from "react";
import { AlertCircle, FileX } from "lucide-react";
import { useReservationsList } from "../../hooks/useReservationsList";
import type { ReservationDto, SortableColumn } from "../../types";
import { SearchBar } from "../shared/SearchBar";
import { PaginationControls } from "../shared/PaginationControls";
import { FilterPanel } from "./FilterPanel";
import { ActiveFiltersBadges } from "./ActiveFiltersBadges";
import { ReservationTable } from "./ReservationTable";
import { ReservationCards } from "./ReservationCards";
import { ErrorState } from "../common/ErrorState";
import { EmptyState } from "../common/EmptyState";
import { hasActiveFilters } from "../../lib/utils/url-params";

/**
 * Główny kontener React zarządzający widokiem listy rezerwacji
 * Koordynuje stan wyszukiwania, filtrowania, sortowania i paginacji
 */
export function ReservationsListContainer() {
  // Hook zarządzający stanem listy rezerwacji
  const {
    reservations,
    isLoading,
    error,
    filters,
    sort,
    pagination,
    total,
    updateFilters,
    updateSort,
    updatePagination,
    clearFilters,
    refetch,
  } = useReservationsList();

  // Handler dla wyszukiwania
  const handleSearchChange = useCallback(
    (search: string) => {
      updateFilters({ search });
    },
    [updateFilters]
  );

  // Handler dla usunięcia pojedynczego filtra
  const handleRemoveFilter = useCallback(
    (filterKey: keyof typeof filters, value?: string) => {
      if (filterKey === "search") {
        updateFilters({ search: "" });
      } else if (filterKey === "statuses" && value) {
        const newStatuses = filters.statuses.filter((s) => s !== value);
        updateFilters({ statuses: newStatuses });
      } else if (filterKey === "source") {
        updateFilters({ source: null });
      } else if (filterKey === "dateRange") {
        updateFilters({ dateRange: { from: null, to: null } });
      }
    },
    [filters, updateFilters]
  );

  // Handler dla sortowania
  const handleSort = useCallback(
    (column: SortableColumn) => {
      updateSort(column);
    },
    [updateSort]
  );

  // Handler dla kliknięcia w wiersz rezerwacji
  const handleRowClick = useCallback((reservation: ReservationDto) => {
    // Nawigacja do szczegółów rezerwacji
    window.location.href = `/rezerwacje/${reservation.id}`;
  }, []);

  // Handler dla akcji na rezerwacji
  const handleAction = useCallback(
    (action: "view" | "edit" | "cancel", reservation: ReservationDto) => {
      if (action === "view") {
        // Otwórz widok szczegółów
        window.location.href = `/rezerwacje/${reservation.id}`;
      } else if (action === "edit") {
        // TODO: Implementacja edycji (otwieranie widoku edycji)
        // eslint-disable-next-line no-console
        console.log("Edit action:", reservation);
      } else if (action === "cancel") {
        // TODO: Pokazać confirmation dialog
        // Po potwierdzeniu: wywołać API do anulowania rezerwacji
        // Po sukcesie: refetch()
        // eslint-disable-next-line no-console
        console.log("Cancel action:", reservation);
      }
    },
    []
  );

  // Sprawdź czy są aktywne filtry
  const hasFilters = hasActiveFilters(filters);

  // Obsługa błędu
  if (error && !isLoading) {
    return (
      <div className="container mx-auto py-8">
        <ErrorState
          title="Błąd ładowania rezerwacji"
          message={error.message || "Nie udało się załadować listy rezerwacji. Spróbuj ponownie."}
          onRetry={refetch}
        />
      </div>
    );
  }

  // Empty state (gdy brak wyników i brak filtrów)
  if (!isLoading && reservations.length === 0 && !hasFilters) {
    return (
      <div className="container mx-auto py-8">
        <EmptyState
          icon={FileX}
          title="Brak rezerwacji"
          description="Nie ma jeszcze żadnych rezerwacji w systemie."
          actionLabel="Dodaj rezerwację"
          onAction={() => {
            // TODO: Nawigacja do formularza nowej rezerwacji
            // eslint-disable-next-line no-console
            console.log("Navigate to new reservation form");
          }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header z tytułem */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Rezerwacje</h1>
        <p className="text-muted-foreground">Zarządzaj wszystkimi rezerwacjami parkingu</p>
      </div>

      {/* Layout z sidebar i główną treścią */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar z filtrami (desktop) */}
        <aside className="hidden lg:block">
          <FilterPanel
            filters={filters}
            onFiltersChange={updateFilters}
            onClearAll={clearFilters}
            isLoading={isLoading}
          />
        </aside>

        {/* Główna treść */}
        <div className="space-y-4">
          {/* SearchBar */}
          <SearchBar
            value={filters.search}
            onChange={handleSearchChange}
            placeholder="Szukaj po nazwisku..."
            isLoading={isLoading}
          />

          {/* FilterPanel dla mobile (collapsible) */}
          <div className="lg:hidden">
            <FilterPanel
              filters={filters}
              onFiltersChange={updateFilters}
              onClearAll={clearFilters}
              isLoading={isLoading}
            />
          </div>

          {/* Active filters badges */}
          {hasFilters && (
            <ActiveFiltersBadges filters={filters} onRemoveFilter={handleRemoveFilter} onClearAll={clearFilters} />
          )}

          {/* Tabela (desktop) / Karty (mobile) */}
          <div>
            {/* Desktop: Tabela */}
            <div className="hidden md:block">
              <ReservationTable
                reservations={reservations}
                isLoading={isLoading}
                sortBy={sort.column}
                sortOrder={sort.order}
                onSort={handleSort}
                onRowClick={handleRowClick}
                onAction={handleAction}
              />
            </div>

            {/* Mobile: Karty */}
            <div className="md:hidden">
              <ReservationCards
                reservations={reservations}
                isLoading={isLoading}
                onCardClick={handleRowClick}
                onAction={handleAction}
              />
            </div>
          </div>

          {/* Empty state z filtrami */}
          {!isLoading && reservations.length === 0 && hasFilters && (
            <EmptyState
              icon={AlertCircle}
              title="Brak wyników"
              description="Nie znaleziono rezerwacji spełniających wybrane kryteria."
              actionLabel="Wyczyść filtry"
              onAction={clearFilters}
            />
          )}

          {/* Paginacja */}
          {!isLoading && reservations.length > 0 && (
            <PaginationControls
              currentPage={pagination.page}
              pageSize={pagination.limit}
              totalItems={total}
              onPageChange={(page) => updatePagination(page)}
              onPageSizeChange={(size) => updatePagination(1, size)}
              disabled={isLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
}
