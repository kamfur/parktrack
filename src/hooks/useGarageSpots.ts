import { useCallback, useEffect, useState } from "react";
import type { CreateGarageSpotCommand, GarageSpotDto, UpdateGarageSpotCommand } from "@/types";
import { toast } from "sonner";

/**
 * Hook do zarządzania miejscami garażowymi (konfigurator).
 * Obsługuje listowanie, tworzenie, edycję oraz szybkie przełączanie dostępności.
 */
export function useGarageSpots() {
  const [spots, setSpots] = useState<GarageSpotDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/garage-spots");
      if (!res.ok) throw new Error("Nie udało się pobrać miejsc garażowych");
      setSpots(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Nieznany błąd"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createSpot = useCallback(
    async (command: CreateGarageSpotCommand) => {
      setIsSaving(true);
      try {
        const res = await fetch("/api/garage-spots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error ?? "Nie udało się utworzyć miejsca garażowego");
        }
        toast.success("Miejsce garażowe utworzone");
        await refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Wystąpił błąd");
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [refetch]
  );

  const updateSpot = useCallback(
    async (id: string, command: UpdateGarageSpotCommand) => {
      setIsSaving(true);
      try {
        const res = await fetch(`/api/garage-spots?id=${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error ?? "Nie udało się zaktualizować miejsca garażowego");
        }
        toast.success("Miejsce garażowe zaktualizowane");
        await refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Wystąpił błąd");
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [refetch]
  );

  const toggleAvailability = useCallback(
    async (spot: GarageSpotDto) => {
      await updateSpot(spot.id, { is_available: !spot.is_available });
    },
    [updateSpot]
  );

  return { spots, isLoading, isSaving, error, refetch, createSpot, updateSpot, toggleAvailability };
}
