import type { CostPreviewProps } from "@/types";
import { useCostCalculation } from "@/hooks/useCostCalculation";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Komponent wyświetlający auto-obliczony koszt rezerwacji.
 * Aktualizowany w czasie rzeczywistym przy zmianie dat.
 */
export function CostPreview({
  checkInDate,
  checkOutDate,
  parkingType = "open_air",
  travelAgencyId = null,
  isCalculating: externalIsCalculating,
}: CostPreviewProps) {
  const {
    estimatedCost,
    baseCost,
    discountPct,
    days,
    isCalculating: hookIsCalculating,
    error,
  } = useCostCalculation(checkInDate, checkOutDate, parkingType, travelAgencyId);

  const isCalculating = externalIsCalculating || hookIsCalculating;

  if (isCalculating) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
        <span className="text-sm text-neutral-600">Koszt:</span>
        <Skeleton className="h-5 w-20" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
        <span className="text-sm text-neutral-600">Koszt:</span>
        <span
          className="text-sm text-neutral-500"
          title="Nie udało się obliczyć kosztu — sprawdź cennik w ustawieniach"
        >
          --
        </span>
      </div>
    );
  }

  if (estimatedCost === null || !checkInDate || !checkOutDate) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
        <span className="text-sm text-neutral-600">Koszt:</span>
        <span className="text-sm text-neutral-500">--</span>
      </div>
    );
  }

  const formatPln = (value: number) => `${value.toFixed(2).replace(".", ",")} zł`;

  if (travelAgencyId && baseCost !== null) {
    return (
      <div className="space-y-1 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm">
        <div className="flex justify-between gap-4 text-neutral-600">
          <span>Cena cennikowa{days > 0 ? ` (${days} ${days === 1 ? "dzień" : "dni"})` : ""}:</span>
          <span>{formatPln(baseCost)}</span>
        </div>
        <div className="flex justify-between gap-4 text-neutral-600">
          <span>Rabat biura:</span>
          <span>{Number(discountPct).toLocaleString("pl-PL", { maximumFractionDigits: 2 })}%</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-sky-200 pt-1">
          <span className="text-neutral-700">Do zapłaty przez biuro:</span>
          <strong className="text-base font-semibold text-neutral-900">{formatPln(estimatedCost)}</strong>
        </div>
        <p className="text-xs text-neutral-500">Klient nie płaci na parkingu — rezerwacja jest opłacona przez biuro.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <span className="text-sm text-neutral-600">Koszt:</span>
      <strong className="text-base font-semibold text-neutral-900">
        {estimatedCost.toFixed(2).replace(".", ",")} zł
      </strong>
      {days > 0 && (
        <span className="text-xs text-neutral-500">
          ({days} {days === 1 ? "dzień" : days < 5 ? "dni" : "dni"})
        </span>
      )}
    </div>
  );
}
