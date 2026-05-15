import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  /** Ikona do wyświetlenia */
  icon: LucideIcon;
  /** Tytuł empty state */
  title: string;
  /** Opis empty state */
  description?: string;
  /** Etykieta przycisku akcji (opcjonalnie) */
  actionLabel?: string;
  /** URL lub callback dla przycisku akcji */
  actionHref?: string;
  /** Callback dla przycisku akcji */
  onAction?: () => void;
}

/**
 * Komponent wyświetlający pusty stan z opcjonalną akcją.
 * Używany gdy brak danych do wyświetlenia (np. brak rezerwacji).
 */
export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref, onAction }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <Icon className="h-16 w-16 text-muted-foreground mb-4" aria-hidden="true" />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}
      {actionLabel && (actionHref || onAction) && (
        <>
          {actionHref ? (
            <Button asChild variant="outline">
              <a href={actionHref}>{actionLabel}</a>
            </Button>
          ) : (
            <Button onClick={onAction} variant="outline">
              {actionLabel}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
