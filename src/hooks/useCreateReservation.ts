import { useState } from "react";
import type { CreateReservationCommand, ReservationDto } from "@/types";
import { toast } from "sonner";

/**
 * Hook do tworzenia nowych rezerwacji.
 * Obsługuje API call, error handling i success notifications.
 *
 * @returns Funkcja do tworzenia rezerwacji oraz stan operacji
 */
export function useCreateReservation() {
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const createReservation = async (data: CreateReservationCommand): Promise<ReservationDto> => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 409) {
          throw new Error("Brak wolnych miejsc w wybranych datach");
        }

        if (response.status === 400) {
          throw new Error(errorData.message || "Nieprawidłowe dane formularza");
        }

        throw new Error("Nie udało się utworzyć rezerwacji");
      }

      const reservation: ReservationDto = await response.json();

      toast.success("Rezerwacja utworzona pomyślnie");

      return reservation;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Wystąpił błąd podczas tworzenia rezerwacji";
      setError(err instanceof Error ? err : new Error(errorMessage));
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createReservation,
    isCreating,
    error,
  };
}
