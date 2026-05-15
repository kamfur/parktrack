import type { DashboardMetrics } from "@/types";
import { MetricCard } from "./MetricCard";
import { ParkingCircle, Calendar, ArrowRight, ArrowLeft } from "lucide-react";

interface MetricsSectionProps {
  metrics: DashboardMetrics;
  isLoading?: boolean;
}

/**
 * Sekcja wyświetlająca cztery karty z kluczowymi metrykami dashboardu.
 * Prezentuje dane w formie wizualnej z użyciem ikon i kolorystyki.
 */
export function MetricsSection({ metrics, isLoading = false }: MetricsSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        icon={<ParkingCircle />}
        value={metrics.availableSpots}
        label="Wolne miejsca"
        accentColor="green"
        isLoading={isLoading}
      />
      <MetricCard
        icon={<Calendar />}
        value={metrics.totalReservations}
        label="Wszystkie rezerwacje"
        accentColor="blue"
        isLoading={isLoading}
      />
      <MetricCard
        icon={<ArrowRight />}
        value={metrics.plannedArrivals}
        label="Przyjazdy"
        accentColor="orange"
        isLoading={isLoading}
      />
      <MetricCard
        icon={<ArrowLeft />}
        value={metrics.plannedDepartures}
        label="Wyjazdy"
        accentColor="purple"
        isLoading={isLoading}
      />
    </div>
  );
}
