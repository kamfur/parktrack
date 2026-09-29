import { useEffect, useState } from "react";
import type { ParkingType } from "@/types";

interface PriceQuoteState {
  totalCost: number | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Debounced GET of a `{ total_cost }` price endpoint, so typing in a datetime-local field
 * does not flood the API. `url = null` clears the quote.
 */
function usePriceQuote(url: string | null): PriceQuoteState {
  const [state, setState] = useState<PriceQuoteState>({ totalCost: null, isLoading: false, error: null });

  useEffect(() => {
    if (!url) {
      setState({ totalCost: null, isLoading: false, error: null });
      return;
    }

    const controller = new AbortController();
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Nie udało się przeliczyć ceny");
        setState({ totalCost: Number(body.total_cost), isLoading: false, error: null });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({
          totalCost: null,
          isLoading: false,
          error: err instanceof Error ? err.message : "Nie udało się przeliczyć ceny",
        });
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [url]);

  return state;
}

/** Live price of an existing reservation for the return date being edited in a driver dialog. */
export function useCheckoutQuote(
  reservationId: string | null,
  checkOutIso: string | null,
  enabled: boolean
): PriceQuoteState {
  const url =
    enabled && reservationId && checkOutIso
      ? `/api/driver/reservations/${reservationId}/quote?${new URLSearchParams({ check_out: checkOutIso })}`
      : null;
  return usePriceQuote(url);
}

/** Price-list preview for a new reservation created from the driver module. */
export function useNewStayQuote(
  checkInIso: string | null,
  checkOutIso: string | null,
  parkingType: ParkingType
): PriceQuoteState {
  const valid = checkInIso && checkOutIso && Date.parse(checkOutIso) > Date.parse(checkInIso);
  const url = valid
    ? `/api/driver/price?${new URLSearchParams({ check_in: checkInIso, check_out: checkOutIso, parking_type: parkingType })}`
    : null;
  return usePriceQuote(url);
}
