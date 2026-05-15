import { Phone, User, Code } from "lucide-react";
import type { ReservationSource } from "../../types";
import { getSourceLabel } from "../../lib/utils/reservation.formatters";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

export interface SourceFilterProps {
  /** Wybrane źródło (null = wszystkie) */
  selectedSource: ReservationSource | null;
  /** Callback wywoływany przy zmianie źródła */
  onChange: (source: ReservationSource | null) => void;
  /** Czy komponent jest disabled */
  disabled?: boolean;
}

/**
 * Ikona dla źródła rezerwacji
 */
function getSourceIcon(source: ReservationSource | "all", className?: string) {
  const iconClass = className || "h-4 w-4";

  const icons = {
    phone: <Phone className={iconClass} />,
    walk_in: <User className={iconClass} />,
    api: <Code className={iconClass} />,
    all: null,
  };

  return icons[source];
}

/**
 * Komponent radio button filtra źródła rezerwacji
 */
export function SourceFilter({ selectedSource, onChange, disabled = false }: SourceFilterProps) {
  // Wszystkie dostępne źródła
  const sources: { value: ReservationSource | null; label: string; icon?: React.ReactNode }[] = [
    { value: null, label: "Wszystkie" },
    { value: "phone", label: getSourceLabel("phone"), icon: getSourceIcon("phone") },
    { value: "walk_in", label: getSourceLabel("walk_in"), icon: getSourceIcon("walk_in") },
    { value: "api", label: getSourceLabel("api"), icon: getSourceIcon("api") },
  ];

  // Handler dla zmiany źródła
  const handleChange = (value: string) => {
    if (value === "all") {
      onChange(null);
    } else {
      onChange(value as ReservationSource);
    }
  };

  // Wartość dla RadioGroup (null -> "all")
  const radioValue = selectedSource || "all";

  return (
    <div className="space-y-3">
      {/* Nagłówek */}
      <h3 className="text-sm font-medium">Źródło</h3>

      {/* Radio group */}
      <RadioGroup value={radioValue} onValueChange={handleChange} disabled={disabled}>
        {sources.map((source) => {
          const value = source.value || "all";

          return (
            <div key={value} className="flex items-center space-x-2">
              <RadioGroupItem value={value} id={`source-${value}`} />
              <Label htmlFor={`source-${value}`} className="flex items-center gap-2 text-sm font-normal cursor-pointer">
                {source.icon && <span className="text-muted-foreground">{source.icon}</span>}
                <span>{source.label}</span>
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}
