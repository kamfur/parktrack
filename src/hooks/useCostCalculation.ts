import { useEffect, useState } from "react";
import type { UseCostCalculationResult, CostCalculationResponse, ParkingType } from "@/types";

/**
 * Hook do obliczania kosztu rezerwacji.
 * Wykonuje API call gdy zmieniają się daty.
 *
 * @param checkInDate - Data przyjazdu
 * @param checkOutDate - Data wyjazdu
 * @param parkingType - Typ miejsca (wiersz cennika)
 * @param travelAgencyId - Biuro podróży (cena po rabacie biura)
 * @param vehicleCount - Liczba aut (cena × liczba aut)
 * @returns Stan obliczania kosztu
 */
export function useCostCalculation(
  checkInDate: Date | null,
  checkOutDate: Date | null,
  parkingType: ParkingType = "open_air",
  travelAgencyId: string | null = null,
  vehicleCount = 1
): UseCostCalculationResult {
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [baseCost, setBaseCost] = useState<number | null>(null);
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [days, setDays] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Reset state if dates are invalid
    if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
      setEstimatedCost(null);
      setBaseCost(null);
      setDiscountPct(0);
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
          parking_type: parkingType,
        });
        if (travelAgencyId) params.set("travel_agency_id", travelAgencyId);
        if (vehicleCount > 1) params.set("vehicle_count", String(vehicleCount));

        const response = await fetch(`/api/calculate-cost?${params.toString()}`);

        if (!response.ok) {
          throw new Error("Failed to calculate cost");
        }

        const data: CostCalculationResponse = await response.json();

        setEstimatedCost(data.totalCost);
        setBaseCost(data.baseCost ?? data.totalCost);
        setDiscountPct(data.discountPct ?? 0);
        setDays(data.days);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
        setEstimatedCost(null);
        setBaseCost(null);
        setDiscountPct(0);
        setDays(0);
      } finally {
        setIsCalculating(false);
      }
    };

    calculateCost();
  }, [checkInDate, checkOutDate, parkingType, travelAgencyId, vehicleCount]);

  return {
    estimatedCost,
    baseCost,
    discountPct,
    days,
    isCalculating,
    error,
  };
}
