import { useCallback, useEffect, useState } from "react";
import type { PriceListDto, SavePriceListCommand } from "@/types";
import { toast } from "sonner";

/**
 * Hook do zarządzania cennikami (okresy obowiązywania + ceny za 1–14 dni).
 */
export function usePriceLists() {
  const [priceLists, setPriceLists] = useState<PriceListDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/price-lists");
      if (!res.ok) throw new Error("Nie udało się pobrać cenników");
      setPriceLists(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Nieznany błąd"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const savePriceList = useCallback(
    async (command: SavePriceListCommand, id?: string) => {
      setIsSaving(true);
      try {
        const res = await fetch(id ? `/api/price-lists/${id}` : "/api/price-lists", {
          method: id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        });
        if (!res.ok) {
          if (res.status === 409) throw new Error("Cennik z tą datą początkową już istnieje");
          const payload = await res.json().catch(() => null);
          throw new Error(typeof payload?.error === "string" ? payload.error : "Nie udało się zapisać cennika");
        }
        toast.success(id ? "Cennik zaktualizowany" : "Cennik dodany");
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

  const deletePriceList = useCallback(
    async (id: string) => {
      setIsSaving(true);
      try {
        const res = await fetch(`/api/price-lists/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Nie udało się usunąć cennika");
        toast.success("Cennik usunięty");
        await refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Wystąpił błąd");
      } finally {
        setIsSaving(false);
      }
    },
    [refetch]
  );

  return { priceLists, isLoading, isSaving, error, refetch, savePriceList, deletePriceList };
}
