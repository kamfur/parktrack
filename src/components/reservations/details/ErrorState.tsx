import React from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  error: Error;
  onRetry?: () => void;
  onBack?: () => void;
}

/**
 * Komponent wyświetlający stan błędu.
 * Pokazuje przyjazny komunikat i akcje do wykonania.
 */
export function ErrorState({ error, onRetry, onBack }: ErrorStateProps) {
  const getErrorMessage = (error: Error): string => {
    if (error.message.includes("not found") || error.message.includes("404")) {
      return "Nie znaleziono rezerwacji. Możliwe, że została usunięta.";
    }

    if (error.message.includes("network") || error.message.includes("fetch")) {
      return "Problem z połączeniem. Sprawdź internet i spróbuj ponownie.";
    }

    if (error.message.includes("timeout")) {
      return "Przekroczono czas oczekiwania. Spróbuj ponownie.";
    }

    return "Nie udało się pobrać danych rezerwacji. Spróbuj ponownie.";
  };

  const getErrorTitle = (error: Error): string => {
    if (error.message.includes("not found") || error.message.includes("404")) {
      return "Rezerwacja nie istnieje";
    }

    if (error.message.includes("network") || error.message.includes("fetch")) {
      return "Brak połączenia";
    }

    return "Błąd ładowania";
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>

      <div className="text-center space-y-2 max-w-md">
        <h2 className="text-lg sm:text-xl font-semibold">{getErrorTitle(error)}</h2>
        <p className="text-sm text-muted-foreground">{getErrorMessage(error)}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        {onBack && (
          <Button onClick={onBack} variant="outline" className="gap-2 w-full sm:w-auto">
            <ArrowLeft className="h-4 w-4" />
            Wróć do listy
          </Button>
        )}
        {onRetry && (
          <Button onClick={onRetry} className="gap-2 w-full sm:w-auto">
            <RefreshCw className="h-4 w-4" />
            Spróbuj ponownie
          </Button>
        )}
      </div>
    </div>
  );
}

