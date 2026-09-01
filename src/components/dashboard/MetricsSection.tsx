import type { StatsData, StatsPeriod } from "@/types";
import { MetricCard } from "./MetricCard";
import { ParkingCircle, ArrowRight, ArrowLeft, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MetricsSectionProps {
  stats: StatsData | null;
  period: StatsPeriod;
  onPeriodChange: (p: StatsPeriod) => void;
  isLoading?: boolean;
}

export function MetricsSection({ stats, period, onPeriodChange, isLoading = false }: MetricsSectionProps) {
  const revenueFormatted = stats
    ? stats.revenue.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " PLN"
    : "0,00 PLN";

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={period === "day" ? "default" : "outline"} size="sm" onClick={() => onPeriodChange("day")}>
          Dziś
        </Button>
        <Button variant={period === "month" ? "default" : "outline"} size="sm" onClick={() => onPeriodChange("month")}>
          Miesiąc
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={<ArrowRight />}
          value={stats?.arrivalsCount ?? 0}
          label="Przyjazdy"
          accentColor="orange"
          isLoading={isLoading}
        />
        <MetricCard
          icon={<ArrowLeft />}
          value={stats?.departuresCount ?? 0}
          label="Wyjazdy"
          accentColor="purple"
          isLoading={isLoading}
        />
        <MetricCard
          icon={<ParkingCircle />}
          value={stats ? `${stats.occupancyPct}%` : "0%"}
          label="Obciążenie"
          accentColor="green"
          subtitle={stats ? `${stats.freeSpots} wolnych miejsc` : undefined}
          isLoading={isLoading}
        />
        <MetricCard
          icon={<DollarSign />}
          value={revenueFormatted}
          label="Przychód"
          accentColor="blue"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
