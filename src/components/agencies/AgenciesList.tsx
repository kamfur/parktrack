import { useTravelAgencies } from "@/hooks/useTravelAgencies";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface AgenciesListProps {
  /** `YYYY-MM` opened by default (previous Warsaw month — month-end invoicing) */
  defaultMonth: string;
}

/** Travel agencies (active first); a click opens the agency's billing month. */
export function AgenciesList({ defaultMonth }: AgenciesListProps) {
  const { agencies, isLoading, error } = useTravelAgencies({ includeArchived: true });

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Biura podróży</h1>
        <p className="text-muted-foreground">
          Rezerwacje biur według miesiąca przyjazdu i miesięczne faktury VAT. Biura dodasz w{" "}
          <a href="/ustawienia#biura-podrozy" className="underline">
            ustawieniach
          </a>
          .
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : agencies.length === 0 ? (
        <p className="text-sm text-neutral-500">Brak biur podróży.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agencies.map((agency) => (
            <li key={agency.id}>
              <a href={`/biura-podrozy/${agency.id}?month=${defaultMonth}`} className="block">
                <Card className="transition-colors hover:bg-muted/40">
                  <CardContent className="space-y-1 p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{agency.name}</span>
                      {agency.archived_at && <Badge variant="outline">Zarchiwizowane</Badge>}
                    </div>
                    <p className="text-sm text-neutral-500">
                      Rabat {Number(agency.discount_pct).toLocaleString("pl-PL")}% · termin {agency.payment_term_days}{" "}
                      dni
                    </p>
                  </CardContent>
                </Card>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
