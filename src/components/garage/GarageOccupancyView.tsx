import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useGarageOccupancy } from "@/hooks/useGarageOccupancy";
import { GarageOccupancyGrid } from "./GarageOccupancyGrid";
import { GarageSwapDialog } from "./GarageSwapDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { warsawDateKey } from "@/lib/calendar/warsaw-time";
import type { GarageOccupancyEntryDto } from "@/types";

interface GarageOccupancyViewProps {
  /** Kierowca: tylko podgląd — bez zamiany przydziałów i propozycji optymalizacji. */
  readOnly?: boolean;
}

export function GarageOccupancyView({ readOnly = false }: GarageOccupancyViewProps) {
  const { entries, spots, suggestions, isLoading, isSwapping, isOptimizing, swap, suggestOptimizations } =
    useGarageOccupancy({ readOnly });
  const [swapTarget, setSwapTarget] = useState<GarageOccupancyEntryDto | null>(null);
  const [monthAnchor, setMonthAnchor] = useState(() => warsawDateKey(new Date()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Obłożenie garaży</h2>
        {readOnly ? null : (
          <Button type="button" variant="outline" onClick={() => void suggestOptimizations()} disabled={isOptimizing}>
            <Sparkles className="mr-2 h-4 w-4" />
            {isOptimizing ? "Analiza..." : "Zaproponuj optymalizację"}
          </Button>
        )}
      </div>

      {suggestions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Propozycje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <p key={index} className="text-sm text-muted-foreground">
                {suggestion.description}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-rose-200" /> zarezerwowane (nazwisko)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-emerald-100" /> dostępne
        </span>
      </div>

      <GarageOccupancyGrid
        spots={spots}
        entries={entries}
        monthAnchor={monthAnchor}
        isLoading={isLoading}
        onMonthChange={setMonthAnchor}
        onSelectEntry={readOnly ? undefined : setSwapTarget}
      />

      {readOnly ? null : (
        <GarageSwapDialog
          entry={swapTarget}
          spots={spots}
          isSwapping={isSwapping}
          onOpenChange={(open) => !open && setSwapTarget(null)}
          onSwap={swap}
        />
      )}
    </div>
  );
}
