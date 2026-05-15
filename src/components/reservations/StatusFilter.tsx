import { CheckCircle2, Clock, XCircle, UserX, CheckSquare } from "lucide-react";
import type { ReservationStatus } from "../../types";
import { getStatusLabel, getStatusColor } from "../../lib/utils/reservation.formatters";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";

export interface StatusFilterProps {
  /** Zaznaczone statusy */
  selectedStatuses: ReservationStatus[];
  /** Callback wywoływany przy zmianie zaznaczenia */
  onChange: (statuses: ReservationStatus[]) => void;
  /** Czy komponent jest disabled */
  disabled?: boolean;
}

/**
 * Ikona dla statusu rezerwacji
 */
function getStatusIcon(status: ReservationStatus, className?: string) {
  const iconClass = className || "h-4 w-4";

  const icons: Record<ReservationStatus, React.ReactNode> = {
    confirmed: <CheckCircle2 className={iconClass} />,
    in_progress: <Clock className={iconClass} />,
    completed: <CheckSquare className={iconClass} />,
    cancelled: <XCircle className={iconClass} />,
    no_show: <UserX className={iconClass} />,
  };

  return icons[status];
}

/**
 * Komponent multi-select filtra statusów rezerwacji
 */
export function StatusFilter({ selectedStatuses, onChange, disabled = false }: StatusFilterProps) {
  // Wszystkie dostępne statusy
  const allStatuses: ReservationStatus[] = ["confirmed", "in_progress", "completed", "cancelled", "no_show"];

  // Handler dla zmiany zaznaczenia pojedynczego statusu
  const handleToggle = (status: ReservationStatus) => {
    if (selectedStatuses.includes(status)) {
      // Odznacz status
      onChange(selectedStatuses.filter((s) => s !== status));
    } else {
      // Zaznacz status
      onChange([...selectedStatuses, status]);
    }
  };

  // Handler dla zaznaczenia wszystkich
  const handleSelectAll = () => {
    if (selectedStatuses.length === allStatuses.length) {
      // Jeśli wszystkie zaznaczone, odznacz wszystkie
      onChange([]);
    } else {
      // Zaznacz wszystkie
      onChange(allStatuses);
    }
  };

  const allSelected = selectedStatuses.length === allStatuses.length;
  const someSelected = selectedStatuses.length > 0 && selectedStatuses.length < allStatuses.length;

  return (
    <div className="space-y-3">
      {/* Nagłówek z opcją "Zaznacz wszystkie" */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Status</h3>
        <button
          type="button"
          onClick={handleSelectAll}
          disabled={disabled}
          className="text-xs text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {allSelected ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
        </button>
      </div>

      {/* Lista checkboxów */}
      <div className="space-y-2">
        {allStatuses.map((status) => {
          const isChecked = selectedStatuses.includes(status);
          const color = getStatusColor(status);
          const label = getStatusLabel(status);

          return (
            <div key={status} className="flex items-center space-x-2">
              <Checkbox
                id={`status-${status}`}
                checked={isChecked}
                onCheckedChange={() => handleToggle(status)}
                disabled={disabled}
              />
              <Label
                htmlFor={`status-${status}`}
                className="flex items-center gap-2 text-sm font-normal cursor-pointer"
              >
                <span className={`text-${color}-600 dark:text-${color}-400`}>{getStatusIcon(status)}</span>
                <span>{label}</span>
              </Label>
            </div>
          );
        })}
      </div>

      {/* Informacja o liczbie zaznaczonych */}
      {someSelected && (
        <p className="text-xs text-muted-foreground">
          Zaznaczono {selectedStatuses.length} z {allStatuses.length}
        </p>
      )}
    </div>
  );
}
