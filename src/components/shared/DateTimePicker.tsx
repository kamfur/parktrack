import { useState } from "react";
import { CalendarIcon, ClockIcon } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";

export interface DateTimePickerProps {
  /** Wybrana data i godzina */
  value: Date | null;
  /** Callback wywoływany przy zmianie daty/godziny */
  onChange: (date: Date | null) => void;
  /** Placeholder dla inputu */
  placeholder?: string;
  /** Czy komponent jest disabled */
  disabled?: boolean;
  /** Minimalna data do wyboru */
  minDate?: Date;
  /** Maksymalna data do wyboru */
  maxDate?: Date;
  /** Czy ma pokazywać błąd walidacji */
  error?: boolean;
  /** Label dla pola */
  label?: string;
}

/**
 * Komponent wyboru daty i godziny
 */
export function DateTimePicker({
  value,
  onChange,
  placeholder = "Wybierz datę i godzinę",
  disabled = false,
  minDate,
  maxDate,
  error = false,
  label: _label,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Synchronizuj timeValue z value
  const timeValue = value ? format(value, "HH:mm") : "00:00";

  // Handler dla wyboru daty w kalendarzu
  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      onChange(null);
      return;
    }

    // Jeśli mamy już wybraną datę, zachowaj godzinę
    if (value) {
      const newDate = new Date(selectedDate);
      newDate.setHours(value.getHours(), value.getMinutes(), 0, 0);
      onChange(newDate);
    } else {
      // Jeśli to pierwsza data, ustaw domyślną godzinę (00:00)
      const newDate = new Date(selectedDate);
      newDate.setHours(0, 0, 0, 0);
      onChange(newDate);
    }
  };

  // Handler dla zmiany godziny
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value;

    if (!value) {
      // Jeśli nie ma daty, nie można ustawić godziny
      return;
    }

    const [hours, minutes] = time.split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes)) {
      return;
    }

    const newDate = new Date(value);
    newDate.setHours(hours, minutes, 0, 0);
    onChange(newDate);
  };

  // Wyłącz daty poza dozwolonym zakresem
  const disabledDates = (date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const displayValue = value ? `${format(value, "dd.MM.yyyy", { locale: pl })} ${format(value, "HH:mm")}` : placeholder;

  return (
    <div className="space-y-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-neutral-500",
              error && "border-red-500 focus-visible:ring-red-500"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayValue}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto max-h-(--radix-popover-content-available-height) overflow-y-auto p-0"
          align="start"
          collisionPadding={8}
        >
          <div className="p-3">
            <Calendar
              mode="single"
              selected={value || undefined}
              onSelect={handleDateSelect}
              disabled={disabledDates}
              initialFocus
              locale={pl}
            />
            <div className="mt-4 border-t pt-4">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4 text-neutral-500" />
                <label className="text-sm font-medium">Godzina:</label>
                <Input type="time" value={timeValue} onChange={handleTimeChange} className="w-32" disabled={!value} />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
