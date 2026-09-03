import { useEffect, useState } from "react";
import type { UseCostCalculationResult, CostCalculationResponse } from "@/types";

/**
 * Hook do obliczania kosztu rezerwacji.
 * Wykonuje API call gdy zmieniają się daty.
 *
 * @param checkInDate - Data przyjazdu
 * @param checkOutDate - Data wyjazdu
 * @returns Stan obliczania kosztu
 */
export function useCostCalculation(checkInDate: Date | null, checkOutDate: Date | null): UseCostCalculationResult {
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [days, setDays] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Reset state if dates are invalid
    if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
      setEstimatedCost(null);
      setDays(0);
      setIsCalculating(false);
      setError(null);
      return;
    }

    const calculateCost = async () => {
      setIsCalculating(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          check_in: checkInDate.toISOString(),
          check_out: checkOutDate.toISOString(),
        });

        const response = await fetch(`/api/calculate-cost?${params.toString()}`);

        if (!response.ok) {
          throw new Error("Failed to calculate cost");
        }

        const data: CostCalculationResponse = await response.json();

        setEstimatedCost(data.totalCost);
        setDays(data.days);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
        setEstimatedCost(null);
        setDays(0);
      } finally {
        setIsCalculating(false);
      }
    };

    calculateCost();
  }, [checkInDate, checkOutDate]);

  return {
    estimatedCost,
    days,
    isCalculating,
    error,
  };
}
