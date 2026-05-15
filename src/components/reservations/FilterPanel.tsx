import { useState } from "react";
import { Filter, ChevronDown, ChevronUp, X } from "lucide-react";
import type { ReservationsListFilters } from "../../types";
import { StatusFilter } from "./StatusFilter";
import { SourceFilter } from "./SourceFilter";
import { DateRangePicker, type DateRange } from "../shared/DateRangePicker";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { hasActiveFilters, countActiveFilters } from "../../lib/utils/url-params";
import { cn } from "@/lib/utils";

export interface FilterPanelProps {
  /** Aktywne filtry */
  filters: ReservationsListFilters;
  /** Callback wywoływany przy zmianie filtrów */
  onFiltersChange: (filters: Partial<ReservationsListFilters>) => void;
  /** Callback wywoływany przy czyszczeniu wszystkich filtrów */
  onClearAll: () => void;
  /** Czy panel jest zwinięty */
  isCollapsed?: boolean;
  /** Callback wywoływany przy zmianie stanu zwinięcia */
  onToggleCollapse?: () => void;
  /** Czy filtry są disabled (np. podczas ładowania) */
  isLoading?: boolean;
}

/**
 * Komponent panelu filtrów z collapsible funkcjonalnością
 */
export function FilterPanel({
  filters,
  onFiltersChange,
  onClearAll,
  isCollapsed: controlledIsCollapsed,
  onToggleCollapse,
  isLoading = false,
}: FilterPanelProps) {
  // Stan lokalny dla collapsible jeśli nie jest kontrolowany z zewnątrz
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);

  // Użyj kontrolowanego stanu jeśli dostępny, w przeciwnym razie lokalny
  const isCollapsed = controlledIsCollapsed !== undefined ? controlledIsCollapsed : internalIsCollapsed;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalIsCollapsed(!internalIsCollapsed);
    }
  };

  // Handlers dla poszczególnych filtrów
  const handleStatusChange = (statuses: typeof filters.statuses) => {
    onFiltersChange({ statuses });
  };

  const handleSourceChange = (source: typeof filters.source) => {
    onFiltersChange({ source });
  };

  const handleDateRangeChange = (dateRange: DateRange) => {
    onFiltersChange({ dateRange });
  };

  const activeFiltersCount = countActiveFilters(filters);
  const hasFilters = hasActiveFilters(filters);

  return (
    <div className={cn("rounded-lg border bg-card", isLoading && "opacity-60 pointer-events-none")}>
      <Collapsible open={!isCollapsed} onOpenChange={handleToggle}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Filtry</h2>
            {activeFiltersCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {activeFiltersCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={onClearAll} disabled={isLoading} className="h-8 px-2 text-xs">
                <X className="h-4 w-4 mr-1" />
                Wyczyść
              </Button>
            )}
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                <span className="sr-only">{isCollapsed ? "Rozwiń filtry" : "Zwiń filtry"}</span>
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Content */}
        <CollapsibleContent>
          <div className="p-4 space-y-6">
            {/* Zakres dat */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Zakres dat</h3>
              <DateRangePicker
                value={filters.dateRange}
                onChange={handleDateRangeChange}
                placeholder="Wybierz zakres dat przyjazdu"
                disabled={isLoading}
              />
            </div>

            {/* Separator */}
            <div className="border-t" />

            {/* Status */}
            <StatusFilter selectedStatuses={filters.statuses} onChange={handleStatusChange} disabled={isLoading} />

            {/* Separator */}
            <div className="border-t" />

            {/* Źródło */}
            <SourceFilter selectedSource={filters.source} onChange={handleSourceChange} disabled={isLoading} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
