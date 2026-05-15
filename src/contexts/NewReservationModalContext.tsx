import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { ReservationDto } from "@/types";
import { NewReservationModal } from "@/components/reservations/NewReservationModal";

interface NewReservationModalContextValue {
  /** Otwórz modal nowej rezerwacji */
  openModal: () => void;
  /** Zamknij modal nowej rezerwacji */
  closeModal: () => void;
  /** Czy modal jest otwarty */
  isOpen: boolean;
}

const NewReservationModalContext = createContext<NewReservationModalContextValue | undefined>(undefined);

interface NewReservationModalProviderProps {
  children: ReactNode;
  /** Callback wywoływany po pomyślnym utworzeniu rezerwacji */
  onSuccess?: (reservation: ReservationDto) => void;
}

/**
 * Provider globalnego stanu modala nowej rezerwacji.
 * Obsługuje również keyboard shortcut (Ctrl+N / Cmd+N).
 */
export function NewReservationModalProvider({ children, onSuccess }: NewReservationModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSuccess = useCallback(
    (reservation: ReservationDto) => {
      onSuccess?.(reservation);
      closeModal();
    },
    [onSuccess, closeModal]
  );

  // Keyboard shortcut: Ctrl+N / Cmd+N
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+N (Windows/Linux) or Cmd+N (Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === "n") {
        // Prevent browser's default "New Window" action
        event.preventDefault();
        openModal();
      }
    };

    // Global event listener for Astro islands
    const handleGlobalOpen = () => {
      openModal();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("openNewReservationModal", handleGlobalOpen);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("openNewReservationModal", handleGlobalOpen);
    };
  }, [openModal]);

  return (
    <NewReservationModalContext.Provider value={{ openModal, closeModal, isOpen }}>
      {children}
      <NewReservationModal isOpen={isOpen} onClose={closeModal} onSuccess={handleSuccess} />
    </NewReservationModalContext.Provider>
  );
}

/**
 * Hook do dostępu do globalnego stanu modala nowej rezerwacji.
 *
 * @example
 * ```tsx
 * const { openModal } = useNewReservationModal();
 *
 * <button onClick={openModal}>+ Nowa rezerwacja</button>
 * ```
 */
export function useNewReservationModal() {
  const context = useContext(NewReservationModalContext);

  if (context === undefined) {
    throw new Error("useNewReservationModal must be used within NewReservationModalProvider");
  }

  return context;
}
