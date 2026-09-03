import { useEffect, useState } from "react";
import type { UseAvailabilityCheckResult, AvailabilityCheckResponse } from "@/types";
import { useDebounce } from "./useDebounce";

/**
 * Hook do sprawdzania dostępności miejsc parkingowych.
 * Wykonuje debounced API call gdy zmieniają się daty.
 *
 * @param checkInDate - Data przyjazdu
 * @param checkOutDate - Data wyjazdu
 * @returns Stan sprawdzania dostępności
 */
export function useAvailabilityCheck(checkInDate: Date | null, checkOutDate: Date | null): UseAvailabilityCheckResult {
  const [availableSpots, setAvailableSpots] = useState<number | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Debounce dates to avoid excessive API calls
  const debouncedCheckIn = useDebounce(checkInDate, 500);
  const debouncedCheckOut = useDebounce(checkOutDate, 500);

  useEffect(() => {
    // Reset state if dates are invalid
    if (!debouncedCheckIn || !debouncedCheckOut) {
      setAvailableSpots(null);
      setIsAvailable(false);
      setIsChecking(false);
      setError(null);
      return;
    }

    const checkAvailability = async () => {
      setIsChecking(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          check_in: debouncedCheckIn.toISOString(),
          check_out: debouncedCheckOut.toISOString(),
        });

        const response = await fetch(`/api/availability?${params.toString()}`);

        if (!response.ok) {
          throw new Error("Failed to check availability");
        }

        const data: AvailabilityCheckResponse = await response.json();

        setAvailableSpots(data.availableSpots);
        setIsAvailable(data.available);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
        setAvailableSpots(null);
        setIsAvailable(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkAvailability();
  }, [debouncedCheckIn, debouncedCheckOut]);

  return {
    availableSpots,
    isAvailable,
    isChecking,
    error,
  };
}
