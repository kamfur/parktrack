import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface DateRangePickerProps {
  /** Wybrany zakres dat */
  value: DateRange;
  /** Callback wywoływany przy zmianie zakresu */
  onChange: (range: DateRange) => void;
  /** Placeholder dla inputu */
  placeholder?: string;
  /** Czy komponent jest disabled */
  disabled?: boolean;
  /** Minimalna data do wyboru */
  minDate?: Date;
  /** Maksymalna data do wyboru */
  maxDate?: Date;
}

/**
 * Komponent wyboru zakresu dat z kalendarzem
 */
export function DateRangePicker({
  value,
  onChange,
  placeholder = "Wybierz zakres dat",
  disabled = false,
  minDate,
  maxDate,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Format wybranego zakresu
  const formatRange = () => {
    if (!value.from && !value.to) {
      return null;
    }

    if (value.from && value.to) {
      return `${format(value.from, "dd.MM.yyyy", { locale: pl })} - ${format(value.to, "dd.MM.yyyy", { locale: pl })}`;
    }

    if (value.from) {
      return `Od ${format(value.from, "dd.MM.yyyy", { locale: pl })}`;
    }

    if (value.to) {
      return `Do ${format(value.to, "dd.MM.yyyy", { locale: pl })}`;
    }

    return null;
  };

  const formattedRange = formatRange();
  const hasSelection = value.from !== null || value.to !== null;

  // Handler dla wyboru daty w kalendarzu
  const handleSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) return;

    // Jeśli nie ma wybranej daty początkowej, ustaw ją
    if (!value.from) {
      onChange({ from: selectedDate, to: null });
      return;
    }

    // Jeśli jest data początkowa ale nie ma końcowej
    if (value.from && !value.to) {
      // Jeśli wybrano datę wcześniejszą niż początkowa, ustaw ją jako początkową
      if (selectedDate < value.from) {
        onChange({ from: selectedDate, to: value.from });
      } else {
        // W przeciwnym razie ustaw jako końcową
        onChange({ from: value.from, to: selectedDate });
      }
      setIsOpen(false); // Zamknij po wyborze drugiej daty
      return;
    }

    // Jeśli już jest pełny zakres, rozpocznij nowy wybór
    onChange({ from: selectedDate, to: null });
  };

  // Handler dla czyszczenia zakresu
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ from: null, to: null });
  };

  // Wyłącz daty poza dozwolonym zakresem
  const disabledDates = (date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-start text-left font-normal", !formattedRange && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formattedRange || placeholder}
          {hasSelection && !disabled && (
            <X className="ml-auto h-4 w-4 opacity-50 hover:opacity-100" onClick={handleClear} />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3">
          <Calendar
            mode="single"
            selected={value.from || undefined}
            onSelect={handleSelect}
            disabled={disabledDates}
            initialFocus
            locale={pl}
          />
          {value.from && !value.to && (
            <p className="mt-2 text-xs text-muted-foreground text-center">Wybierz datę końcową</p>
          )}
          {value.from && value.to && (
            <div className="mt-2 flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Wybrano zakres</span>
              <Button variant="ghost" size="sm" onClick={() => onChange({ from: null, to: null })} className="h-7 px-2">
                Wyczyść
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
