import { useCallback, useEffect, useState } from "react";
import type { InvoiceDto, InvoiceSortableColumn, InvoicesListResponse, InvoicesQueryParams } from "../types";

const PAGE_SIZES = [10, 25, 50, 100];

const SORT_COLUMNS: InvoiceSortableColumn[] = ["created_at", "invoice_number", "buyer_name", "total_amount"];

const DEFAULT_PARAMS: InvoicesQueryParams = {
  search: "",
  sortBy: "created_at",
  sortOrder: "desc",
  page: 1,
  limit: 25,
};

/**
 * Odczytuje parametry listy z query stringa (deep linking / odświeżenie strony)
 */
function parseUrlParams(): InvoicesQueryParams {
  if (typeof window === "undefined") {
    return DEFAULT_PARAMS;
  }

  const params = new URLSearchParams(window.location.search);

  const sortBy = params.get("sort_by") as InvoiceSortableColumn | null;
  const page = parseInt(params.get("page") || "1", 10);
  const limit = parseInt(params.get("limit") || "25", 10);

  return {
    search: params.get("search") || "",
    sortBy: sortBy && SORT_COLUMNS.includes(sortBy) ? sortBy : DEFAULT_PARAMS.sortBy,
    sortOrder: params.get("sort_order") === "asc" ? "asc" : "desc",
    page: page > 0 ? page : 1,
    limit: PAGE_SIZES.includes(limit) ? limit : DEFAULT_PARAMS.limit,
  };
}

function buildQueryString(params: InvoicesQueryParams): string {
  const search = new URLSearchParams();

  if (params.search) {
    search.set("search", params.search);
  }
  search.set("sort_by", params.sortBy);
  search.set("sort_order", params.sortOrder);
  search.set("page", params.page.toString());
  search.set("limit", params.limit.toString());

  return search.toString();
}

function updateUrl(queryString: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.history.pushState({}, "", `${window.location.pathname}?${queryString}`);
}

/**
 * Custom hook zarządzający listą faktur (wyszukiwanie, sortowanie, paginacja)
 */
export function useInvoicesList() {
  const [params, setParams] = useState<InvoicesQueryParams>(DEFAULT_PARAMS);
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchInvoices = useCallback(async (next: InvoicesQueryParams) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/invoices?${buildQueryString(next)}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data: InvoicesListResponse = await response.json();

      setInvoices(data.data);
      setTotal(data.total);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error fetching invoices:", err);
      setError(err instanceof Error ? err : new Error("An unexpected error occurred"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Inicjalizacja - odczyt URL params i pierwszy fetch
  useEffect(() => {
    const urlParams = parseUrlParams();
    setParams(urlParams);
    fetchInvoices(urlParams);
  }, [fetchInvoices]);

  const applyParams = useCallback(
    (next: InvoicesQueryParams) => {
      setParams(next);
      updateUrl(buildQueryString(next));
      fetchInvoices(next);
    },
    [fetchInvoices]
  );

  const updateSearch = useCallback(
    (search: string) => {
      applyParams({ ...params, search, page: 1 });
    },
    [applyParams, params]
  );

  const updateSort = useCallback(
    (column: InvoiceSortableColumn) => {
      const order: "asc" | "desc" = params.sortBy === column && params.sortOrder === "desc" ? "asc" : "desc";
      applyParams({ ...params, sortBy: column, sortOrder: order });
    },
    [applyParams, params]
  );

  const updatePagination = useCallback(
    (page: number, limit?: number) => {
      const nextLimit = limit ?? params.limit;
      applyParams({ ...params, page: nextLimit !== params.limit ? 1 : page, limit: nextLimit });
    },
    [applyParams, params]
  );

  const refetch = useCallback(() => {
    fetchInvoices(params);
  }, [fetchInvoices, params]);

  return {
    invoices,
    total,
    isLoading,
    error,
    search: params.search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    pagination: { page: params.page, limit: params.limit },
    updateSearch,
    updateSort,
    updatePagination,
    refetch,
  };
}
