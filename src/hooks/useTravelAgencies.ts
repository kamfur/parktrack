import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { SaveTravelAgencyCommand, TravelAgencyDto } from "@/types";

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const payload = await res.json().catch(() => null);
  return typeof payload?.error === "string" ? payload.error : fallback;
}

/**
 * Travel agencies for Settings (`includeArchived: true`) or reservation pickers (active only).
 */
export function useTravelAgencies({ includeArchived = false }: { includeArchived?: boolean } = {}) {
  const [agencies, setAgencies] = useState<TravelAgencyDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/travel-agencies${includeArchived ? "?include_archived=true" : ""}`);
      if (!res.ok) throw new Error("Nie udało się pobrać biur podróży");
      setAgencies(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Nieznany błąd"));
    } finally {
      setIsLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const saveAgency = useCallback(
    async (command: SaveTravelAgencyCommand, id?: string) => {
      setIsSaving(true);
      try {
        const res = await fetch(id ? `/api/travel-agencies/${id}` : "/api/travel-agencies", {
          method: id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        });
        if (!res.ok) throw new Error(await errorMessage(res, "Nie udało się zapisać biura"));
        toast.success(id ? "Biuro zaktualizowane" : "Biuro dodane");
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

  const setArchived = useCallback(
    async (id: string, archived: boolean) => {
      setIsSaving(true);
      try {
        const res = await fetch(`/api/travel-agencies/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived }),
        });
        if (!res.ok) throw new Error(await errorMessage(res, "Nie udało się zmienić statusu biura"));
        toast.success(archived ? "Biuro zarchiwizowane" : "Biuro przywrócone");
        await refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Wystąpił błąd");
      } finally {
        setIsSaving(false);
      }
    },
    [refetch]
  );

  const deleteAgency = useCallback(
    async (id: string) => {
      setIsSaving(true);
      try {
        const res = await fetch(`/api/travel-agencies/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(await errorMessage(res, "Nie udało się usunąć biura"));
        toast.success("Biuro usunięte");
        await refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Wystąpił błąd");
      } finally {
        setIsSaving(false);
      }
    },
    [refetch]
  );

  return { agencies, isLoading, isSaving, error, refetch, saveAgency, setArchived, deleteAgency };
}
