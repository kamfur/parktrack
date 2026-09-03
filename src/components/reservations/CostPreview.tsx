import type { CostPreviewProps } from "@/types";
import { useCostCalculation } from "@/hooks/useCostCalculation";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Komponent wyświetlający auto-obliczony koszt rezerwacji.
 * Aktualizowany w czasie rzeczywistym przy zmianie dat.
 */
export function CostPreview({ checkInDate, checkOutDate, isCalculating: externalIsCalculating }: CostPreviewProps) {
  const {
    estimatedCost,
    days,
    isCalculating: hookIsCalculating,
    error,
  } = useCostCalculation(checkInDate, checkOutDate);

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
        <span className="text-sm text-neutral-500" title="Koszt zostanie obliczony automatycznie">
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
