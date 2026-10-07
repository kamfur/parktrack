import { Loader2 } from "lucide-react";
import { formatCost } from "@/lib/utils/reservation.formatters";

interface PaymentQuoteProps {
  totalCost: number | null;
  surcharge?: number | null;
  isLoading: boolean;
  error: string | null;
}

/** Amount to collect, recalculated as the return date changes in arrival/departure dialogs. */
export function PaymentQuote({ totalCost, surcharge, isLoading, error }: PaymentQuoteProps) {
  const extra = surcharge && surcharge > 0 ? surcharge : 0;

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <span>Cena pobytu</span>
        <span className="flex items-center gap-2 font-medium">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {totalCost != null ? formatCost(totalCost) : "—"}
        </span>
      </div>
      {extra > 0 ? (
        <div className="flex items-center justify-between gap-2">
          <span>Dopłata</span>
          <span className="font-medium">{formatCost(extra)}</span>
        </div>
      ) : null}
      <div className="mt-1 flex items-center justify-between gap-2 border-t border-amber-200 pt-1 text-base font-semibold">
        <span>Do zapłaty</span>
        <span>{totalCost != null ? formatCost(totalCost + extra) : "—"}</span>
      </div>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
