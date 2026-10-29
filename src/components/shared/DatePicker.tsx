import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  /** Wybrana data */
  value: Date | null;
  /** Callback wywoływany przy zmianie daty */
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
}

/**
 * Komponent wyboru pojedynczej daty z kalendarzem
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Wybierz datę",
  disabled = false,
  minDate,
  maxDate,
  error = false,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Handler dla wyboru daty w kalendarzu
  const handleSelect = (selectedDate: Date | undefined) => {
    onChange(selectedDate || null);
    setIsOpen(false);
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
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-neutral-500",
            error && "border-red-500 focus-visible:ring-red-500"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "dd.MM.yyyy", { locale: pl }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto max-h-(--radix-popover-content-available-height) overflow-y-auto p-0"
        align="start"
        collisionPadding={8}
      >
        <Calendar
          mode="single"
          selected={value || undefined}
          onSelect={handleSelect}
          disabled={disabledDates}
          initialFocus
          locale={pl}
        />
      </PopoverContent>
    </Popover>
  );
}
