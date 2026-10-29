import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import type { AgencyMonthCategory, AgencyMonthRowDto } from "@/types";
import { useAgencyMonth } from "@/hooks/useAgencyMonth";
import { useTravelAgency } from "@/hooks/useTravelAgencies";
import { addUtcMonths } from "@/lib/calendar/warsaw-time";
import { formatCost, formatFullName } from "@/lib/utils/reservation.formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AgencyMonthViewProps {
  agencyId: string;
  /** `YYYY-MM` */
  month: string;
}

const ARRIVAL_LABELS: Record<AgencyMonthCategory, string> = {
  invoiceable: "Przyjechał",
  blocking: "Oczekuje",
  excluded: "—",
  invoiced: "Przyjechał",
};

function arrivalLabel(row: AgencyMonthRowDto): string {
  if (row.category === "excluded") return row.status === "no_show" ? "Nie przyjechał" : "Anulowana";
  return ARRIVAL_LABELS[row.category];
}

function arrivalBadgeClass(row: AgencyMonthRowDto): string {
  if (row.category === "blocking") return "bg-amber-100 text-amber-900 hover:bg-amber-100";
  if (row.category === "excluded") return "bg-neutral-100 text-neutral-600 hover:bg-neutral-100";
  return "bg-green-100 text-green-800 hover:bg-green-100";
}

const formatWarsaw = (iso: string) =>
  new Date(iso).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  });

function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1, 15)).toLocaleDateString("pl-PL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const shiftMonth = (month: string, delta: number) => addUtcMonths(`${month}-01`, delta).slice(0, 7);

function goToMonth(month: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("month", month);
  window.location.assign(url.toString());
}

/**
 * Agency billing month: reservations by planned check-in (Europe/Warsaw), arrival state,
 * amount to invoice, pending arrivals that block invoicing, and the agency's invoices.
 */
export function AgencyMonthView({ agencyId, month }: AgencyMonthViewProps) {
  const agency = useTravelAgency(agencyId);
  const { summary, invoices, isLoading, isIssuing, error, issueInvoice } = useAgencyMonth(agencyId, month);

  const [year, monthNumber] = month.split("-");
  const monthTag = `${monthNumber}/${year}`;
  const blocking = summary?.rows.filter((row) => row.category === "blocking") ?? [];

  const disabledReason = !summary
    ? null
    : summary.invoice
      ? `Faktura ${summary.invoice.invoice_number} już wystawiona`
      : !summary.monthClosed
        ? "Miesiąc jeszcze trwa"
        : blocking.length > 0
          ? "Rozstrzygnij rezerwacje oczekujące na przyjazd"
          : summary.counts.invoiceable === 0
            ? "Brak zrealizowanych rezerwacji"
            : null;

  const handleIssue = async () => {
    if (!window.confirm(`Wystawić fakturę VAT dla biura za ${monthTag}?`)) return;
    const result = await issueInvoice();
    if (result.invoiceId) window.location.assign(`/faktury/${result.invoiceId}/druk`);
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <a href="/biura-podrozy" className="text-sm text-neutral-500 hover:underline">
            ← Biura podróży
          </a>
          <h1 className="text-3xl font-bold tracking-tight">{agency?.name ?? "Biuro podróży"}</h1>
          {agency && (
            <p className="text-sm text-neutral-500">
              NIP {agency.nip} · rabat {Number(agency.discount_pct).toLocaleString("pl-PL")}% · termin płatności{" "}
              {agency.payment_term_days} dni
            </p>
          )}
        </div>
        <div className="flex items-center gap-2" aria-label="Miesiąc rozliczeniowy">
          <Button
            variant="outline"
            size="icon"
            onClick={() => goToMonth(shiftMonth(month, -1))}
            aria-label="Poprzedni miesiąc"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-36 text-center font-medium capitalize">{monthLabel(month)}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => goToMonth(shiftMonth(month, 1))}
            aria-label="Następny miesiąc"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {isLoading || !summary ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Do zafakturowania za {monthTag}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end justify-between gap-4">
              <dl className="grid grid-cols-3 gap-6 text-sm">
                <div>
                  <dt className="text-neutral-500">Netto</dt>
                  <dd className="text-lg font-semibold">{formatCost(summary.totals.net)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">VAT</dt>
                  <dd className="text-lg font-semibold">{formatCost(summary.totals.vat)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Brutto</dt>
                  <dd className="text-2xl font-bold">{formatCost(summary.totals.gross)}</dd>
                </div>
              </dl>
              <div className="flex flex-col items-end gap-1">
                {summary.invoice ? (
                  <a href={`/faktury/${summary.invoice.id}/druk`}>
                    <Button variant="outline" className="gap-2">
                      <FileText className="h-4 w-4" />
                      Pokaż fakturę {summary.invoice.invoice_number}
                    </Button>
                  </a>
                ) : (
                  <Button onClick={handleIssue} disabled={disabledReason !== null || isIssuing} className="gap-2">
                    <FileText className="h-4 w-4" />
                    {isIssuing ? "Wystawianie…" : `Wystaw fakturę za ${monthTag}`}
                  </Button>
                )}
                {!summary.invoice && disabledReason && <p className="text-sm text-neutral-500">{disabledReason}</p>}
              </div>
            </CardContent>
          </Card>

          {blocking.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
              <p className="font-medium">
                {blocking.length === 1
                  ? "1 rezerwacja nie ma potwierdzonego przyjazdu."
                  : `${blocking.length} rezerwacje nie mają potwierdzonego przyjazdu.`}{" "}
                Potwierdź przyjazd albo oznacz „Nie przyjechał”, zanim wystawisz fakturę:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {blocking.map((row) => (
                  <li key={row.reservation_id}>
                    <a href={`/rezerwacje/${row.reservation_id}`} className="underline">
                      {formatFullName(row.first_name, row.last_name)}
                    </a>{" "}
                    — przyjazd {formatWarsaw(row.planned_check_in)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <section aria-labelledby="agency-reservations-heading" className="space-y-2">
            <h2 id="agency-reservations-heading" className="text-lg font-medium">
              Rezerwacje z przyjazdem w {monthLabel(month)} ({summary.rows.length})
            </h2>
            {summary.rows.length === 0 ? (
              <p className="text-sm text-neutral-500">Brak rezerwacji tego biura w wybranym miesiącu.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Klient</TableHead>
                      <TableHead>Rejestracja</TableHead>
                      <TableHead>Przyjazd</TableHead>
                      <TableHead>Wyjazd</TableHead>
                      <TableHead>Status przyjazdu</TableHead>
                      <TableHead className="text-right">Brutto</TableHead>
                      <TableHead>Faktura</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.rows.map((row) => (
                      <TableRow key={row.reservation_id}>
                        <TableCell>
                          <a href={`/rezerwacje/${row.reservation_id}`} className="font-medium hover:underline">
                            {formatFullName(row.first_name, row.last_name)}
                          </a>
                        </TableCell>
                        <TableCell>{row.license_plate ?? "—"}</TableCell>
                        <TableCell>{formatWarsaw(row.planned_check_in)}</TableCell>
                        <TableCell>{formatWarsaw(row.planned_check_out)}</TableCell>
                        <TableCell>
                          <Badge className={arrivalBadgeClass(row)}>{arrivalLabel(row)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {row.category === "excluded" ? "—" : formatCost(row.gross_amount ?? row.total_cost)}
                        </TableCell>
                        <TableCell>
                          {row.invoice_id ? (
                            <a href={`/faktury/${row.invoice_id}/druk`} className="text-sm hover:underline">
                              {row.invoice_number}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <section aria-labelledby="agency-invoices-heading" className="space-y-2">
            <h2 id="agency-invoices-heading" className="text-lg font-medium">
              Faktury biura
            </h2>
            {invoices.length === 0 ? (
              <p className="text-sm text-neutral-500">Biuro nie ma jeszcze faktur.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numer</TableHead>
                      <TableHead>Okres</TableHead>
                      <TableHead>Wystawiona</TableHead>
                      <TableHead>Termin płatności</TableHead>
                      <TableHead className="text-right">Brutto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <a href={`/faktury/${invoice.id}/druk`} className="font-medium hover:underline">
                            {invoice.invoice_number}
                          </a>
                        </TableCell>
                        <TableCell className="capitalize">
                          {invoice.billing_year && invoice.billing_month
                            ? monthLabel(`${invoice.billing_year}-${String(invoice.billing_month).padStart(2, "0")}`)
                            : "—"}
                        </TableCell>
                        <TableCell>{invoice.issue_date.split("-").reverse().join(".")}</TableCell>
                        <TableCell>{invoice.payment_due_date?.split("-").reverse().join(".") ?? "—"}</TableCell>
                        <TableCell className="text-right">{formatCost(Number(invoice.total_amount))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
