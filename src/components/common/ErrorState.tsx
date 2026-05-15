import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  /** Tytuł komunikatu błędu */
  title?: string;
  /** Szczegółowy opis błędu */
  message: string;
  /** Callback dla przycisku "Spróbuj ponownie" */
  onRetry?: () => void;
  /** Etykieta przycisku retry */
  retryLabel?: string;
}

/**
 * Komponent wyświetlający stan błędu z opcją ponowienia.
 * Używany gdy wystąpi błąd podczas ładowania danych lub wykonywania akcji.
 */
export function ErrorState({
  title = "Wystąpił błąd",
  message,
  onRetry,
  retryLabel = "Spróbuj ponownie",
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8" role="alert" aria-live="assertive">
      <div className="text-center space-y-4 max-w-md">
        <AlertCircle className="h-16 w-16 text-destructive mx-auto" aria-hidden="true" />
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-muted-foreground">{message}</p>
        {onRetry && (
          <Button onClick={onRetry} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
