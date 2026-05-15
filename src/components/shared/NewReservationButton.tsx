import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NewReservationButtonProps {
  /** Wariant wyświetlania przycisku */
  variant?: "default" | "floating";
  /** Dodatkowe klasy CSS */
  className?: string;
}

/**
 * Przycisk do otwierania modala nowej rezerwacji.
 * Obsługuje dwa warianty: default (inline) i floating (FAB).
 */
export function NewReservationButton({ variant = "default", className }: NewReservationButtonProps) {
  // Use global event dispatcher for Astro islands compatibility
  // This works even when component is rendered outside the provider
  const openModal = () => {
    window.dispatchEvent(new CustomEvent("openNewReservationModal"));
  };

  if (variant === "floating") {
    return (
      <button
        onClick={openModal}
        className={cn(
          "fixed bottom-6 right-6 z-40",
          "flex h-14 w-14 items-center justify-center",
          "rounded-full bg-neutral-900 text-white shadow-lg",
          "transition-all duration-200",
          "hover:bg-neutral-800 hover:scale-110 hover:shadow-xl",
          "active:scale-95",
          "focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:ring-offset-2",
          "sm:h-auto sm:w-auto sm:px-6 sm:py-3 sm:rounded-md",
          className
        )}
        aria-label="Nowa rezerwacja"
        title="Nowa rezerwacja (Ctrl+N)"
      >
        <Plus className="h-6 w-6 sm:mr-2" />
        <span className="hidden sm:inline">Nowa rezerwacja</span>
      </button>
    );
  }

  return (
    <Button onClick={openModal} className={className}>
      <Plus className="mr-2 h-4 w-4" />
      Nowa rezerwacja
    </Button>
  );
}
