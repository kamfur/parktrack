import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_VEHICLE_COUNT } from "@/lib/vehicles";

interface VehicleCountInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Accessible name of the group, also used to label the buttons. */
  label?: string;
}

/** Stepper for the number of cars in a reservation (1..MAX_VEHICLE_COUNT). */
export function VehicleCountInput({ value, onChange, disabled, label = "Liczba aut" }: VehicleCountInputProps) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="max-lg:h-12 max-lg:w-12"
        aria-label="Mniej aut"
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <output
        aria-live="polite"
        className="min-w-8 text-center text-base font-semibold tabular-nums max-lg:min-w-10 max-lg:text-lg"
      >
        {value}
      </output>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="max-lg:h-12 max-lg:w-12"
        aria-label="Więcej aut"
        disabled={disabled || value >= MAX_VEHICLE_COUNT}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
