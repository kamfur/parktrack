import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormDescription, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface ManualPriceInputProps {
  /** Agreed price in PLN for the whole reservation; null = price list. */
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}

/**
 * Optional agreed price (e.g. a regular-customer discount). Empty = price from the price list;
 * a filled value is kept even when dates, parking type or the car count change later.
 */
export function ManualPriceInput({ value, onChange, disabled }: ManualPriceInputProps) {
  return (
    <FormItem>
      <FormLabel>Cena ustalona z klientem (zł)</FormLabel>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          placeholder="Cena z cennika"
          disabled={disabled}
          value={value ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === "" || Number.isNaN(e.target.valueAsNumber) ? null : e.target.valueAsNumber);
          }}
        />
        {value != null ? (
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange(null)}>
            Cena z cennika
          </Button>
        ) : null}
      </div>
      <FormDescription>
        Opcjonalnie. Kwota za całą rezerwację (wszystkie auta) — nie zmienia się po zmianie dat ani typu miejsca.
      </FormDescription>
      <FormMessage />
    </FormItem>
  );
}
