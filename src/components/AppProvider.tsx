import type { ReactNode } from "react";
import { NewReservationModalProvider } from "@/contexts/NewReservationModalContext";
import type { ReservationDto } from "@/types";

interface AppProviderProps {
  children: ReactNode;
}

/**
 * Główny provider aplikacji.
 * Zawiera wszystkie globalne contexty i providery.
 */
export function AppProvider({ children }: AppProviderProps) {
  // Handler po pomyślnym utworzeniu rezerwacji
  const handleReservationSuccess = (reservation: ReservationDto) => {
    console.log("Rezerwacja utworzona:", reservation);

    // Invalidate cache - reload strony aby odświeżyć dane
    // W przyszłości można użyć React Query lub podobnego do lepszego cache management
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return <NewReservationModalProvider onSuccess={handleReservationSuccess}>{children}</NewReservationModalProvider>;
}
