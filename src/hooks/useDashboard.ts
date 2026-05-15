import { useState, useEffect } from "react";
import type { DashboardState, DashboardMetrics, ReservationDto, CheckInCommand, CheckOutCommand } from "@/types";

/**
 * Funkcja pomocnicza do kalkulacji metryk dashboardu.
 * @param arrivals - Lista dzisiejszych przyjazdów
 * @param departures - Lista dzisiejszych wyjazdów
 * @param totalSpots - Całkowita liczba miejsc parkingowych
 * @returns Obiekt z metrykami dashboardu
 */
function calculateMetrics(
  arrivals: ReservationDto[],
  departures: ReservationDto[],
  totalSpots: number
): DashboardMetrics {
  // Rezerwacje aktywne na dziś (in_progress + confirmed arrivals)
  const activeReservations = arrivals.filter((r) => r.status === "confirmed" || r.status === "in_progress").length;

  return {
    availableSpots: totalSpots - activeReservations,
    totalReservations: arrivals.length + departures.length,
    plannedArrivals: arrivals.length,
    plannedDepartures: departures.length,
  };
}

/**
 * Custom hook do zarządzania stanem i logiką dashboardu.
 * Obsługuje pobieranie danych, check-in i check-out rezerwacji.
 *
 * @returns Obiekt zawierający stan dashboardu i funkcje do wykonywania akcji
 */
export function useDashboard() {
  // Stan
  const [state, setState] = useState<DashboardState>({
    data: null,
    isLoading: true,
    error: null,
    isProcessing: false,
  });

  /**
   * Funkcja pobierająca dane dashboardu z API.
   * Wykonuje równoległe zapytania do endpointów arrivals, departures i settings.
   */
  const fetchDashboardData = async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Równoległe zapytania do API
      const [arrivalsRes, departuresRes, settingsRes] = await Promise.all([
        fetch("/api/rpc/get_todays_arrivals", { method: "POST" }),
        fetch("/api/reservations/departures", { method: "POST" }),
        fetch("/api/settings?key=eq.total_parking_spots"),
      ]);

      if (!arrivalsRes.ok || !departuresRes.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      const arrivals: ReservationDto[] = await arrivalsRes.json();
      const departures: ReservationDto[] = await departuresRes.json();

      // Pobierz total_parking_spots z settings (fallback do 100 jeśli błąd lub brak danych)
      let totalSpots = 100; // Default fallback value
      if (settingsRes.ok) {
        try {
          const settings = await settingsRes.json();
          // value jest JSONB, więc trzeba sparsować
          if (settings && settings.value !== null && settings.value !== undefined) {
            const parsedValue =
              typeof settings.value === "string" ? parseInt(settings.value, 10) : Number(settings.value);
            if (!isNaN(parsedValue) && parsedValue > 0) {
              totalSpots = parsedValue;
            }
          }
        } catch (error) {
          // Używaj domyślnej wartości 100 jeśli parsing się nie powiedzie
          console.warn("Failed to parse total_parking_spots setting, using default 100:", error);
        }
      } else {
        // 404 lub inny błąd - używamy fallback value
        console.warn(
          `Failed to fetch total_parking_spots setting (status: ${settingsRes.status}), using default 100`
        );
      }

      // Kalkulacja metryk
      const metrics = calculateMetrics(arrivals, departures, totalSpots);

      setState({
        data: {
          todaysArrivals: arrivals,
          todaysDepartures: departures,
          metrics,
        },
        isLoading: false,
        error: null,
        isProcessing: false,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error("Unknown error"),
      }));
    }
  };

  /**
   * Funkcja wykonująca check-in rezerwacji.
   * @param reservationId - UUID rezerwacji do zameldowania
   * @throws Error jeśli operacja się nie powiedzie
   */
  const handleCheckIn = async (reservationId: string) => {
    setState((prev) => ({ ...prev, isProcessing: true }));

    try {
      const command: CheckInCommand = {
        status: "in_progress",
        actual_check_in: new Date().toISOString(),
      };

      const response = await fetch(`/api/reservations?id=eq.${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        throw new Error("Failed to check-in");
      }

      // Odświeżenie danych po sukcesie
      await fetchDashboardData();
    } finally {
      setState((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  /**
   * Funkcja wykonująca check-out rezerwacji.
   * @param reservationId - UUID rezerwacji do wymeldowania
   * @throws Error jeśli operacja się nie powiedzie
   */
  const handleCheckOut = async (reservationId: string) => {
    setState((prev) => ({ ...prev, isProcessing: true }));

    try {
      const command: CheckOutCommand = {
        status: "completed",
        actual_check_out: new Date().toISOString(),
      };

      const response = await fetch(`/api/reservations?id=eq.${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        throw new Error("Failed to check-out");
      }

      // Odświeżenie danych po sukcesie
      await fetchDashboardData();
    } finally {
      setState((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  // Inicjalizacja: pobierz dane przy montowaniu
  useEffect(() => {
    fetchDashboardData();
  }, []);

  return {
    ...state,
    refetch: fetchDashboardData,
    handleCheckIn,
    handleCheckOut,
  };
}
