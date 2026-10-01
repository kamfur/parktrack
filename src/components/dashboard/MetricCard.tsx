import type { MetricCardProps } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Komponent wyświetlający pojedynczą kartę metryki.
 * Prezentuje wartość liczbową, etykietę oraz ikonę z kolorowym akcentem.
 */
export function MetricCard({ icon, value, label, accentColor, isLoading = false, subtitle }: MetricCardProps) {
  const accentColorClasses = {
    green: "border-l-green-500",
    blue: "border-l-blue-500",
    orange: "border-l-orange-500",
    purple: "border-l-purple-500",
    teal: "border-l-teal-500",
    indigo: "border-l-indigo-500",
  };

  const iconColorClasses = {
    green: "text-green-500",
    blue: "text-blue-500",
    orange: "text-orange-500",
    purple: "text-purple-500",
    teal: "text-teal-500",
    indigo: "text-indigo-500",
  };

  const displayValue = typeof value === "number" && value < 0 ? "N/A" : value;

  if (isLoading) {
    return (
      <Card className="border-l-4 border-l-gray-300">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="h-12 w-12 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-l-4", accentColorClasses[accentColor])}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold">{displayValue}</p>
            {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
          </div>
          <div className={cn("text-4xl", iconColorClasses[accentColor])}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
