import { useState } from "react";
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subDays } from "date-fns";
import { BarChart3, Banknote, CalendarRange, Gauge, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { DateRangePicker, type DateRange } from "@/components/shared/DateRangePicker";
import { useAnalytics } from "@/hooks/useAnalytics";
import type { AnalyticsGranularity } from "@/types";
import { RevenueChart } from "./RevenueChart";
import { OccupancyChart } from "./OccupancyChart";
import { BreakdownCharts } from "./BreakdownCharts";
import { formatPln } from "./chart-format";

const MAX_DAILY_RANGE_DAYS = 93;
const toKey = (date: Date) => format(date, "yyyy-MM-dd");

interface Preset {
  id: string;
  label: string;
  range: () => DateRange;
}

const PRESETS: Preset[] = [
  {
    id: "month",
    label: "Bieżący miesiąc",
    range: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }),
  },
  { id: "30", label: "Ostatnie 30 dni", range: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { id: "90", label: "Ostatnie 90 dni", range: () => ({ from: subDays(new Date(), 89), to: new Date() }) },
  { id: "year", label: "Ten rok", range: () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }) },
];

function granularityFor(from: Date, to: Date): AnalyticsGranularity {
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  return days > MAX_DAILY_RANGE_DAYS ? "month" : "day";
}

export function StatsContainer() {
  const [presetId, setPresetId] = useState<string | null>("month");
  const [range, setRange] = useState<DateRange>(() => PRESETS[0].range());

  const complete = range.from && range.to ? { from: range.from, to: range.to } : null;
  const fromKey = complete ? toKey(complete.from) : "";
  const toKeyValue = complete ? toKey(complete.to) : "";
  const granularity = complete ? granularityFor(complete.from, complete.to) : "day";

  const { data, isLoading, error, retry } = useAnalytics(fromKey, toKeyValue, granularity);

  const selectPreset = (preset: Preset) => {
    setPresetId(preset.id);
    setRange(preset.range());
  };

  const change = data?.revenue.changePct;
  const ChangeIcon = change != null && change < 0 ? TrendingDown : TrendingUp;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            size="sm"
            variant={presetId === preset.id ? "default" : "outline"}
            onClick={() => selectPreset(preset)}
          >
            {preset.label}
          </Button>
        ))}
        <div className="w-full sm:w-72">
          <DateRangePicker
            value={range}
            onChange={(next) => {
              setPresetId(null);
              setRange(next);
            }}
          />
        </div>
      </div>

      {!complete ? (
        <EmptyState icon={CalendarRange} title="Wybierz zakres dat" description="Podaj datę początkową i końcową." />
      ) : error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={<Banknote />}
              label="Przychód"
              value={data ? formatPln(data.revenue.total) : "—"}
              accentColor="indigo"
              isLoading={isLoading}
              subtitle={
                data?.revenue.changePct != null
                  ? `${data.revenue.changePct > 0 ? "+" : ""}${data.revenue.changePct}% vs poprzedni okres`
                  : "Brak okresu porównawczego"
              }
            />
            <MetricCard
              icon={<ChangeIcon />}
              label="Średnio na rezerwację"
              value={data ? formatPln(data.revenue.avgPerReservation) : "—"}
              accentColor="green"
              isLoading={isLoading}
            />
            <MetricCard
              icon={<BarChart3 />}
              label="Średnio na dobę"
              value={data ? formatPln(data.revenue.avgPerDay) : "—"}
              accentColor="teal"
              isLoading={isLoading}
            />
            <MetricCard
              icon={<Gauge />}
              label="Szczyt obłożenia"
              value={data ? `${data.occupancy.peakPct}%` : "—"}
              accentColor="orange"
              isLoading={isLoading}
              subtitle={data ? `${data.occupancy.totalSpots} miejsc` : undefined}
            />
          </div>

          {data && (
            <div className={isLoading ? "space-y-6 opacity-60 transition-opacity" : "space-y-6"}>
              <RevenueChart data={data} />
              <OccupancyChart data={data} />
              <BreakdownCharts data={data} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
