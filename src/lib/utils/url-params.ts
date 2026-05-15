import type {
  ReservationsQueryParams,
  ReservationsListFilters,
  SortParams,
  PaginationParams,
  ReservationStatus,
  ReservationSource,
} from "../../types";

/**
 * Parsuje parametry URL do obiektu ReservationsQueryParams
 * @param url - URL string lub URLSearchParams
 * @returns Obiekt z parametrami zapytania
 */
export function parseQueryParams(url: string | URLSearchParams): Partial<ReservationsQueryParams> {
  const params = typeof url === "string" ? new URLSearchParams(url) : url;

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
  const column = params.get("sort_by") || "created_at";
  const order = params.get("sort_order") === "asc" ? "asc" : ("desc" as "asc" | "desc");

  // Parsowanie paginacji
  const page = parseInt(params.get("page") || "1", 10);
  const limit = parseInt(params.get("limit") || "25", 10);

  return {
    search,
    statuses,
    source,
    dateRange: { from: dateFrom, to: dateTo },
    column,
    order,
    page: page > 0 ? page : 1,
    limit: [10, 25, 50, 100].includes(limit) ? limit : 25,
  };
}

/**
 * Buduje query string z parametrów
 * @param filters - filtry
 * @param sort - parametry sortowania
 * @param pagination - parametry paginacji
 * @returns Query string
 */
export function buildQueryString(
  filters: ReservationsListFilters,
  sort: SortParams,
  pagination: PaginationParams
): string {
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
 * @param queryString - query string do ustawienia
 * @param pathname - opcjonalna ścieżka (domyślnie obecna)
 */
export function updateUrlParams(queryString: string, pathname?: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const path = pathname || window.location.pathname;
  const newUrl = queryString ? `${path}?${queryString}` : path;
  window.history.pushState({}, "", newUrl);
}

/**
 * Usuwa konkretny parametr z URL
 * @param paramName - nazwa parametru do usunięcia
 */
export function removeUrlParam(paramName: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  params.delete(paramName);

  const queryString = params.toString();
  const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;

  window.history.pushState({}, "", newUrl);
}

/**
 * Dodaje lub aktualizuje pojedynczy parametr w URL
 * @param paramName - nazwa parametru
 * @param value - wartość parametru
 */
export function setUrlParam(paramName: string, value: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  params.set(paramName, value);

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.pushState({}, "", newUrl);
}

/**
 * Sprawdza czy są aktywne jakiekolwiek filtry
 * @param filters - obiekt filtrów
 * @returns true jeśli są aktywne filtry
 */
export function hasActiveFilters(filters: ReservationsListFilters): boolean {
  return (
    filters.search.length > 0 ||
    filters.statuses.length > 0 ||
    filters.source !== null ||
    filters.dateRange.from !== null ||
    filters.dateRange.to !== null
  );
}

/**
 * Liczy liczbę aktywnych filtrów
 * @param filters - obiekt filtrów
 * @returns Liczba aktywnych filtrów
 */
export function countActiveFilters(filters: ReservationsListFilters): number {
  let count = 0;

  if (filters.search.length > 0) count++;
  if (filters.statuses.length > 0) count += filters.statuses.length;
  if (filters.source !== null) count++;
  if (filters.dateRange.from !== null || filters.dateRange.to !== null) count++;

  return count;
}
