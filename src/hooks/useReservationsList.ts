import { useState, useEffect, useMemo, useCallback } from "react";
import type {
  ReservationsListState,
  ReservationsListFilters,
  ReservationStatus,
  ReservationSource,
  SortParams,
  PaginationParams,
  ReservationsListResponse,
  SortableColumn,
} from "../types";

/**
 * Parsuje parametry URL do stanu filtrów
 */
function parseUrlParams(): Partial<ReservationsListState> {
  if (typeof window === "undefined") {
    return {};
  }

  const params = new URLSearchParams(window.location.search);

  // Parsowanie search
  const search = params.get("search") || "";

  // Parsowanie statusów (może być wiele)
  const statuses = params.getAll("status") as ReservationStatus[];

  // Parsowanie źródła
  const sourceParam = params.get("source");
  const source: ReservationSource | null =
    sourceParam === "phone" || sourceParam === "walk_in" || sourceParam === "api" ? sourceParam : null;

  // Parsowanie zakresu dat
  const dateFromStr = params.get("date_from");
  const dateToStr = params.get("date_to");
  const dateFrom = dateFromStr ? new Date(dateFromStr) : null;
  const dateTo = dateToStr ? new Date(dateToStr) : null;

  // Parsowanie sortowania
  const sortBy = params.get("sort_by") || "created_at";
  const sortOrder = params.get("sort_order") === "asc" ? "asc" : "desc";

  // Parsowanie paginacji
  const page = parseInt(params.get("page") || "1", 10);
  const limit = parseInt(params.get("limit") || "25", 10);

  return {
    filters: {
      search,
      statuses,
      source,
      dateRange: { from: dateFrom, to: dateTo },
    },
    sort: {
      column: sortBy,
      order: sortOrder,
    },
    pagination: {
      page: page > 0 ? page : 1,
      limit: [10, 25, 50, 100].includes(limit) ? limit : 25,
    },
  };
}

/**
 * Buduje query string z parametrów stanu
 */
function buildQueryString(filters: ReservationsListFilters, sort: SortParams, pagination: PaginationParams): string {
  const params = new URLSearchParams();

  // Dodaj search
  if (filters.search) {
    params.set("search", filters.search);
  }

  // Dodaj statusy (wiele wartości)
  filters.statuses.forEach((status) => {
    params.append("status", status);
  });

  // Dodaj źródło
  if (filters.source) {
    params.set("source", filters.source);
  }

  // Dodaj zakres dat
  if (filters.dateRange.from) {
    params.set("date_from", filters.dateRange.from.toISOString());
  }
  if (filters.dateRange.to) {
    params.set("date_to", filters.dateRange.to.toISOString());
  }

  // Dodaj sortowanie
  params.set("sort_by", sort.column);
  params.set("sort_order", sort.order);

  // Dodaj paginację
  params.set("page", pagination.page.toString());
  params.set("limit", pagination.limit.toString());

  return params.toString();
}

/**
 * Aktualizuje URL bez przeładowania strony
 */
function updateUrl(queryString: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const newUrl = `${window.location.pathname}?${queryString}`;
  window.history.pushState({}, "", newUrl);
}

/**
 * Funkcja debounce
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Custom hook dla zarządzania listą rezerwacji
 */
export function useReservationsList() {
  const [state, setState] = useState<ReservationsListState>({
    reservations: [],
    isLoading: true,
    error: null,
    filters: {
      search: "",
      statuses: [],
      source: null,
      dateRange: { from: null, to: null },
    },
    sort: {
      column: "created_at",
      order: "desc",
    },
    pagination: {
      page: 1,
      limit: 25,
    },
    total: 0,
  });

  /**
   * Pobiera rezerwacje z API
   */
  const fetchReservations = useCallback(
    async (filters: ReservationsListFilters, sort: SortParams, pagination: PaginationParams) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const queryString = buildQueryString(filters, sort, pagination);
        const response = await fetch(`/api/reservations?${queryString}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data: ReservationsListResponse = await response.json();

        setState((prev) => ({
          ...prev,
          reservations: data.data,
          total: data.total,
          isLoading: false,
          error: null,
        }));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error fetching reservations:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error : new Error("An unexpected error occurred"),
        }));
      }
    },
    []
  );

  /**
   * Inicjalizacja - odczyt URL params i fetch danych
   */
  useEffect(() => {
    const urlParams = parseUrlParams();

    setState((prev) => ({
      ...prev,
      filters: urlParams.filters || prev.filters,
      sort: urlParams.sort || prev.sort,
      pagination: urlParams.pagination || prev.pagination,
    }));

    // Fetch z parametrami z URL
    const filters = urlParams.filters || state.filters;
    const sort = urlParams.sort || state.sort;
    const pagination = urlParams.pagination || state.pagination;

    fetchReservations(filters, sort, pagination);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Wykonaj tylko przy mount

  /**
   * Debounced search handler
   */
  const debouncedFetch = useMemo(() => debounce(fetchReservations, 300), [fetchReservations]);

  /**
   * Aktualizuje filtry i wykonuje zapytanie
   */
  const updateFilters = useCallback(
    (newFilters: Partial<ReservationsListFilters>) => {
      setState((prev) => {
        const updatedFilters = { ...prev.filters, ...newFilters };
        const updatedPagination = { ...prev.pagination, page: 1 }; // Reset do strony 1

        // Aktualizuj URL
        const queryString = buildQueryString(updatedFilters, prev.sort, updatedPagination);
        updateUrl(queryString);

        // Jeśli zmiana search, użyj debounce, w przeciwnym razie fetch natychmiast
        if ("search" in newFilters) {
          debouncedFetch(updatedFilters, prev.sort, updatedPagination);
        } else {
          fetchReservations(updatedFilters, prev.sort, updatedPagination);
        }

        return {
          ...prev,
          filters: updatedFilters,
          pagination: updatedPagination,
        };
      });
    },
    [debouncedFetch, fetchReservations]
  );

  /**
   * Aktualizuje sortowanie
   */
  const updateSort = useCallback(
    (column: SortableColumn) => {
      setState((prev) => {
        // Toggle order jeśli ta sama kolumna, w przeciwnym razie użyj desc
        const newOrder: "asc" | "desc" = prev.sort.column === column && prev.sort.order === "desc" ? "asc" : "desc";

        const updatedSort: SortParams = {
          column,
          order: newOrder,
        };

        // Aktualizuj URL
        const queryString = buildQueryString(prev.filters, updatedSort, prev.pagination);
        updateUrl(queryString);

        // Fetch z nowym sortowaniem
        fetchReservations(prev.filters, updatedSort, prev.pagination);

        return {
          ...prev,
          sort: updatedSort,
        };
      });
    },
    [fetchReservations]
  );

  /**
   * Aktualizuje paginację
   */
  const updatePagination = useCallback(
    (page: number, limit?: number) => {
      setState((prev) => {
        const updatedPagination: PaginationParams = {
          page,
          limit: limit !== undefined ? limit : prev.pagination.limit,
        };

        // Jeśli zmieniono limit, zresetuj do strony 1
        if (limit !== undefined && limit !== prev.pagination.limit) {
          updatedPagination.page = 1;
        }

        // Aktualizuj URL
        const queryString = buildQueryString(prev.filters, prev.sort, updatedPagination);
        updateUrl(queryString);

        // Fetch z nową paginacją
        fetchReservations(prev.filters, prev.sort, updatedPagination);

        return {
          ...prev,
          pagination: updatedPagination,
        };
      });
    },
    [fetchReservations]
  );

  /**
   * Czyści wszystkie filtry
   */
  const clearFilters = useCallback(() => {
    const clearedFilters: ReservationsListFilters = {
      search: "",
      statuses: [],
      source: null,
      dateRange: { from: null, to: null },
    };

    setState((prev) => {
      const updatedPagination = { ...prev.pagination, page: 1 };

      // Aktualizuj URL
      const queryString = buildQueryString(clearedFilters, prev.sort, updatedPagination);
      updateUrl(queryString);

      // Fetch z wymazanymi filtrami
      fetchReservations(clearedFilters, prev.sort, updatedPagination);

      return {
        ...prev,
        filters: clearedFilters,
        pagination: updatedPagination,
      };
    });
  }, [fetchReservations]);

  /**
   * Refetch - ponowne pobranie danych z aktualnymi parametrami
   */
  const refetch = useCallback(() => {
    fetchReservations(state.filters, state.sort, state.pagination);
  }, [fetchReservations, state.filters, state.sort, state.pagination]);

  return {
    // Stan
    reservations: state.reservations,
    isLoading: state.isLoading,
    error: state.error,
    filters: state.filters,
    sort: state.sort,
    pagination: state.pagination,
    total: state.total,

    // Akcje
    updateFilters,
    updateSort,
    updatePagination,
    clearFilters,
    refetch,
  };
}
