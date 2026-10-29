import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlateConfirmationProps {
  plate: string;
  formatWarning?: boolean;
  onConfirm(): void;
}

/**
 * Shown while a dictated plate is unconfirmed. In the PoC 27% of plates were misheard,
 * some with high confidence — so the plate is always read back before saving.
 */
export function PlateConfirmation({ plate, formatWarning, onConfirm }: PlateConfirmationProps) {
  return (
    <div
      role="group"
      aria-label="Potwierdzenie numeru rejestracyjnego"
      className="flex flex-col gap-2 rounded-md border border-sky-300 bg-sky-50 p-3 dark:border-sky-800 dark:bg-sky-950 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Sprawdź z klientem numer z dyktowania:</p>
        <p className="font-mono text-2xl font-semibold tracking-widest">{plate}</p>
        {formatWarning && (
          <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-3" aria-hidden="true" />
            Nietypowy format tablicy — upewnij się, że numer jest poprawny.
          </p>
        )}
      </div>
      <Button type="button" onClick={onConfirm}>
        <Check aria-hidden="true" />
        Potwierdź rejestrację
      </Button>
    </div>
  );
}
