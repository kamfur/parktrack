import { Ban, CircleDollarSign, UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/MetricCard";
import type { AnalyticsData } from "@/types";
import { formatPln } from "./chart-format";

export function QualitySection({ data }: { data: AnalyticsData }) {
  const { quality, receivables, topAgencies } = data;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={<Ban />}
          label="Anulowania"
          value={`${quality.cancelledPct}%`}
          accentColor="orange"
          subtitle={`${quality.cancelled} z ${quality.total} rezerwacji`}
        />
        <MetricCard
          icon={<UserX />}
          label="No-show"
          value={`${quality.noShowPct}%`}
          accentColor="purple"
          subtitle={`${quality.noShow} z ${quality.total} rezerwacji`}
        />
        <MetricCard
          icon={<CircleDollarSign />}
          label="Nieopłacone pobyty"
          value={formatPln(receivables.amount)}
          accentColor="green"
          subtitle={`${receivables.count} zakończonych, klienci indywidualni`}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top biura podróży według przychodu</CardTitle>
        </CardHeader>
        <CardContent>
          {topAgencies.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Brak pobytów biur w tym okresie</p>
          ) : (
            <ol className="divide-y">
              {topAgencies.map((agency, index) => (
                <li key={agency.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="w-5 text-muted-foreground">{index + 1}.</span>
                    <a href={`/biura-podrozy/${agency.id}`} className="truncate font-medium hover:underline">
                      {agency.name}
                    </a>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="font-semibold">{formatPln(agency.revenue)}</span>
                    <span className="ml-2 text-muted-foreground">{agency.stays} pobytów</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
