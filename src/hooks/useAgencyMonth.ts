import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { AgencyMonthRowDto, AgencyMonthSummaryDto, InvoiceDto } from "@/types";

interface IssueResult {
  invoiceId: string | null;
  /** Reservations to resolve when issuing was refused because of pending arrivals */
  blocking: AgencyMonthRowDto[];
}

/**
 * One agency's billing month (`YYYY-MM`): reservations, amount to invoice, issued invoices,
 * and issuing the monthly VAT invoice.
 */
export function useAgencyMonth(agencyId: string, month: string) {
  const [summary, setSummary] = useState<AgencyMonthSummaryDto | null>(null);
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isIssuing, setIsIssuing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [summaryRes, invoicesRes] = await Promise.all([
        fetch(`/api/travel-agencies/${agencyId}/summary?month=${month}`),
        fetch(`/api/travel-agencies/${agencyId}/invoices`),
      ]);
      if (!summaryRes.ok || !invoicesRes.ok) throw new Error("Nie udało się pobrać danych biura");
      setSummary(await summaryRes.json());
      setInvoices(await invoicesRes.json());
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Nieznany błąd"));
    } finally {
      setIsLoading(false);
    }
  }, [agencyId, month]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const issueInvoice = useCallback(async (): Promise<IssueResult> => {
    setIsIssuing(true);
    try {
      const res = await fetch(`/api/travel-agencies/${agencyId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(typeof payload?.error === "string" ? payload.error : "Nie udało się wystawić faktury");
        await refetch();
        return { invoiceId: null, blocking: Array.isArray(payload?.blocking) ? payload.blocking : [] };
      }
      toast.success("Faktura wystawiona");
      await refetch();
      return { invoiceId: payload.invoiceId as string, blocking: [] };
    } finally {
      setIsIssuing(false);
    }
  }, [agencyId, month, refetch]);

  return { summary, invoices, isLoading, isIssuing, error, refetch, issueInvoice };
}
