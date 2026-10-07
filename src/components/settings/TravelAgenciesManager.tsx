import { useState } from "react";
import { Plus } from "lucide-react";
import type { TravelAgencyDto } from "@/types";
import { useTravelAgencies } from "@/hooks/useTravelAgencies";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TravelAgencyDialog, type TravelAgencyDialogState } from "./TravelAgencyDialog";

/** `1234563218` → `123-456-32-18` */
function formatNip(nip: string): string {
  return nip.length === 10 ? `${nip.slice(0, 3)}-${nip.slice(3, 6)}-${nip.slice(6, 8)}-${nip.slice(8)}` : nip;
}

function formatPercent(value: number): string {
  return `${Number(value).toLocaleString("pl-PL", { maximumFractionDigits: 2 })}%`;
}

/**
 * Travel agencies billed monthly for their clients. Agencies with reservations
 * cannot be deleted — archiving hides them from the reservation form.
 */
export function TravelAgenciesManager() {
  const { agencies, isLoading, isSaving, error, saveAgency, setArchived, deleteAgency } = useTravelAgencies({
    includeArchived: true,
  });
  const [dialogState, setDialogState] = useState<TravelAgencyDialogState | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const visible = showArchived ? agencies : agencies.filter((agency) => agency.archived_at === null);
  const archivedCount = agencies.length - agencies.filter((agency) => agency.archived_at === null).length;

  const handleDelete = (agency: TravelAgencyDto) => {
    if (window.confirm(`Usunąć biuro „${agency.name}”? Biura z rezerwacjami można tylko zarchiwizować.`)) {
      void deleteAgency(agency.id);
    }
  };

  return (
    <section className="space-y-4" aria-labelledby="travel-agencies-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl space-y-1">
          <h2 id="travel-agencies-heading" className="text-lg font-medium">
            Biura podróży
          </h2>
          <p className="text-sm text-neutral-500">
            Biuro płaci za rezerwacje swoich klientów — na koniec miesiąca wystawiasz mu jedną fakturę VAT. Rabat obniża
            cenę z cennika i jest zapamiętywany w rezerwacji w chwili przypisania biura.
          </p>
        </div>
        <Button type="button" onClick={() => setDialogState({ mode: "create" })} disabled={isLoading}>
          <Plus className="mr-2 h-4 w-4" />
          Nowe biuro
        </Button>
      </div>

      {archivedCount > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="travel-agencies-show-archived"
            checked={showArchived}
            onCheckedChange={(checked) => setShowArchived(checked === true)}
          />
          <Label htmlFor="travel-agencies-show-archived" className="font-normal">
            Pokaż zarchiwizowane ({archivedCount})
          </Label>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : visible.length === 0 ? (
        <p className="text-sm text-neutral-500">Brak biur podróży.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {visible.map((agency) => {
            const archived = agency.archived_at !== null;
            return (
              <li key={agency.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{agency.name}</span>
                    {archived && <Badge variant="outline">Zarchiwizowane</Badge>}
                  </div>
                  <div className="text-sm text-neutral-500">
                    NIP {formatNip(agency.nip)} · rabat {formatPercent(agency.discount_pct)} · termin{" "}
                    {agency.payment_term_days} dni
                  </div>
                </div>
                <div className="flex gap-1">
                  {!archived && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isSaving}
                      onClick={() => setDialogState({ mode: "edit", agency })}
                    >
                      Edytuj
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => void setArchived(agency.id, !archived)}
                  >
                    {archived ? "Przywróć" : "Archiwizuj"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    disabled={isSaving}
                    onClick={() => handleDelete(agency)}
                  >
                    Usuń
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <TravelAgencyDialog
        state={dialogState}
        isSaving={isSaving}
        onOpenChange={(open) => !open && setDialogState(null)}
        onSave={saveAgency}
      />
    </section>
  );
}
