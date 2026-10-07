import { useState } from "react";
import { Plus } from "lucide-react";
import type { PriceListDto } from "@/types";
import { usePriceLists } from "@/hooks/usePriceLists";
import { activePriceList, emptyPriceListRates } from "@/lib/pricing/price-list";
import { warsawDateKey } from "@/lib/calendar/warsaw-time";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceListTable } from "./PriceListTable";
import { PriceListDialog, type PriceListDialogState } from "./PriceListDialog";

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

function periodLabel(list: PriceListDto): string {
  return list.valid_to
    ? `${formatDate(list.valid_from)} – ${formatDate(list.valid_to)}`
    : `od ${formatDate(list.valid_from)} bezterminowo`;
}

/**
 * Period-based price lists: staff add a list valid from a date (optionally until
 * a date); the list covering the arrival day with the latest start date applies.
 */
export function PriceListsManager() {
  const { priceLists, isLoading, isSaving, error, savePriceList, deletePriceList } = usePriceLists();
  const [dialogState, setDialogState] = useState<PriceListDialogState | null>(null);

  const today = warsawDateKey(new Date());
  const current = activePriceList(priceLists, today);

  const handleCreate = () => {
    setDialogState({ mode: "create", template: current?.rates ?? emptyPriceListRates(), validFrom: today });
  };

  const handleDelete = (list: PriceListDto) => {
    const confirmed = window.confirm(`Usunąć cennik ${periodLabel(list)}?`);
    if (confirmed) void deletePriceList(list.id);
  };

  return (
    <section className="space-y-4" aria-labelledby="price-lists-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl space-y-1">
          <h2 id="price-lists-heading" className="text-lg font-medium">
            Cennik
          </h2>
          <p className="text-sm text-neutral-500">
            Ceny łączne za pobyt od 1 do 14 dni oraz cena za każdą dobę powyżej 14 dni, osobno dla parkingu, wiat i
            garaży. Rezerwację wycenia cennik obowiązujący w dniu przyjazdu; gdy okresy się nakładają, wygrywa ten z
            najpóźniejszą datą początkową — np. bezterminowy cennik podstawowy i nałożony na niego okres 1 lutego – 15
            maja.
          </p>
        </div>
        <Button type="button" onClick={handleCreate} disabled={isLoading}>
          <Plus className="mr-2 h-4 w-4" />
          Nowy okres cennika
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {!isLoading && !error && !current && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
          Żaden cennik nie obowiązuje dzisiaj — nowych rezerwacji nie da się wycenić. Dodaj okres cennika.
        </p>
      )}

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : priceLists.length === 0 ? (
        <p className="text-sm text-neutral-500">Brak zdefiniowanych cenników.</p>
      ) : (
        <ul className="space-y-6">
          {priceLists.map((list) => (
            <li key={list.id} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium">{periodLabel(list)}</h3>
                {current?.id === list.id && <Badge className="bg-green-100 text-green-800">Obowiązuje dziś</Badge>}
                {list.valid_from > today && <Badge variant="outline">Zaplanowany</Badge>}
                {list.valid_to !== null && list.valid_to < today && <Badge variant="outline">Zakończony</Badge>}
                <div className="ml-auto flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => setDialogState({ mode: "edit", priceList: list })}
                  >
                    Edytuj
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    disabled={isSaving}
                    onClick={() => handleDelete(list)}
                  >
                    Usuń
                  </Button>
                </div>
              </div>
              <PriceListTable mode="view" rates={list.rates} />
            </li>
          ))}
        </ul>
      )}

      <PriceListDialog
        state={dialogState}
        isSaving={isSaving}
        onOpenChange={(open) => !open && setDialogState(null)}
        onSave={savePriceList}
      />
    </section>
  );
}
