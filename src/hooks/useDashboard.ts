import { useState, useEffect, useRef } from "react";
import type { DashboardState, DashboardMetrics, ReservationDto, StatsPeriod, StatsData } from "@/types";
import { createCheckInCommand, createCheckOutCommand } from "@/lib/reservations/operations";

function calculateMetrics(
  arrivals: ReservationDto[],
  departures: ReservationDto[],
  totalSpots: number
): DashboardMetrics {
  const activeReservations = arrivals.filter((r) => r.status === "confirmed" || r.status === "in_progress").length;
  return {
    availableSpots: totalSpots - activeReservations,
    totalReservations: arrivals.length + departures.length,
    plannedArrivals: arrivals.length,
    plannedDepartures: departures.length,
  };
}

export function useDashboard() {
  const [state, setState] = useState<DashboardState>({
    data: null,
    isLoading: true,
    error: null,
    isProcessing: false,
  });
  const [period, setPeriod] = useState<StatsPeriod>("day");
  const initialized = useRef(false);

  const fetchDashboardData = async (activePeriod: StatsPeriod = period) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const [arrivalsRes, departuresRes, settingsRes, statsRes] = await Promise.all([
        fetch("/api/rpc/get_todays_arrivals", { method: "POST" }),
        fetch("/api/reservations/departures", { method: "POST" }),
        fetch("/api/settings?key=eq.total_parking_spots"),
        fetch(`/api/stats?period=${activePeriod}`),
      ]);

      if (!arrivalsRes.ok || !departuresRes.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      const arrivals: ReservationDto[] = await arrivalsRes.json();
      const departures: ReservationDto[] = await departuresRes.json();

      let totalSpots = 100;
      if (settingsRes.ok) {
        try {
          const settings = await settingsRes.json();
          if (settings && settings.value !== null && settings.value !== undefined) {
            const parsedValue =
              typeof settings.value === "string" ? parseInt(settings.value, 10) : Number(settings.value);
            if (!isNaN(parsedValue) && parsedValue > 0) {
              totalSpots = parsedValue;
            }
          }
        } catch (error) {
          console.warn("Failed to parse total_parking_spots setting, using default 100:", error);
        }
      } else {
        console.warn(`Failed to fetch total_parking_spots setting (status: ${settingsRes.status}), using default 100`);
      }

      const metrics = calculateMetrics(arrivals, departures, totalSpots);

      let stats: StatsData | null = null;
      if (statsRes.ok) {
        stats = await statsRes.json();
      } else {
        console.warn(`Failed to fetch stats (status: ${statsRes.status})`);
      }

      setState({
        data: {
          todaysArrivals: arrivals,
          todaysDepartures: departures,
          metrics,
          stats,
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

  const handleCheckIn = async (reservationId: string) => {
    setState((prev) => ({ ...prev, isProcessing: true }));
    try {
      const command = createCheckInCommand();
      const response = await fetch(`/api/reservations?id=eq.${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      if (!response.ok) throw new Error("Failed to check-in");
      await fetchDashboardData(period);
    } finally {
      setState((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  const handleCheckOut = async (reservationId: string) => {
    setState((prev) => ({ ...prev, isProcessing: true }));
    try {
      const command = createCheckOutCommand();
      const response = await fetch(`/api/reservations?id=eq.${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      if (!response.ok) throw new Error("Failed to check-out");
      await fetchDashboardData(period);
    } finally {
      setState((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (!initialized.current) {
      initialized.current = true;
      fetchDashboardData(period);
    } else {
      // Debounce period-change fetches so rapid toggle clicks don't spam requests
      timer = setTimeout(() => fetchDashboardData(period), 400);
    }

    const id = setInterval(() => fetchDashboardData(period), 60000);
    return () => {
      clearTimeout(timer);
      clearInterval(id);
    };
  }, [period]);

  return {
    ...state,
    period,
    setPeriod,
    refetch: () => fetchDashboardData(period),
    handleCheckIn,
    handleCheckOut,
  };
}
