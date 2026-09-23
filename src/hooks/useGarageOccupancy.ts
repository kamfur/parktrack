import { useCallback, useEffect, useState } from "react";
import type { GarageOccupancyEntryDto, GarageOptimizationSuggestionDto, GarageSpotDto } from "@/types";
import { toast } from "sonner";

/**
 * Hook do widoku obłożenia garaży: listuje aktywne przydziały i skonfigurowane
 * miejsca, obsługuje ręczną zamianę oraz opisową propozycję optymalizacji.
 */
export function useGarageOccupancy() {
  const [entries, setEntries] = useState<GarageOccupancyEntryDto[]>([]);
  const [spots, setSpots] = useState<GarageSpotDto[]>([]);
  const [suggestions, setSuggestions] = useState<GarageOptimizationSuggestionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [entriesRes, spotsRes] = await Promise.all([fetch("/api/garage-assignments"), fetch("/api/garage-spots")]);
      if (!entriesRes.ok || !spotsRes.ok) throw new Error("Nie udało się pobrać obłożenia garaży");
      setEntries(await entriesRes.json());
      setSpots(await spotsRes.json());
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Nieznany błąd"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const swap = useCallback(
    async (reservationId: string, garageSpotId: string) => {
      setIsSwapping(true);
      try {
        const res = await fetch("/api/garage-assignments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId, garageSpotId }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          if (res.status === 409) {
            throw new Error(payload?.error ?? "Zamiana naruszyłaby bufor 10h");
          }
          throw new Error(payload?.error ?? "Nie udało się zamienić przydziału");
        }
        toast.success("Przydział zaktualizowany");
        await refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Wystąpił błąd");
        throw err;
      } finally {
        setIsSwapping(false);
      }
    },
    [refetch]
  );

  const suggestOptimizations = useCallback(async () => {
    setIsOptimizing(true);
    try {
      const res = await fetch("/api/garage-assignments/optimize");
      if (!res.ok) throw new Error("Nie udało się pobrać propozycji optymalizacji");
      setSuggestions(await res.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wystąpił błąd");
    } finally {
      setIsOptimizing(false);
    }
  }, []);

  return {
    entries,
    spots,
    suggestions,
    isLoading,
    isSwapping,
    isOptimizing,
    error,
    refetch,
    swap,
    suggestOptimizations,
  };
}
