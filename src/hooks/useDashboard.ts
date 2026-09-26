import { useState, useEffect, useRef } from "react";
import type {
  DashboardState,
  DashboardMetrics,
  DepartureListItem,
  ReservationDto,
  StatsPeriod,
  StatsData,
} from "@/types";
import { fetchGarageSpotNameMap, type GarageSpotNameMap } from "@/lib/garage/spot-names";
import { isCoveredParkingType } from "@/lib/pricing/parking-type";
import type { CreateLegacyDepartureCommand } from "@/lib/schemas/reservation.schema";

function withGarageSpotName(items: DepartureListItem[], spotNames: GarageSpotNameMap): DepartureListItem[] {
  return items.map((item) =>
    isCoveredParkingType(item.parking_type) ? { ...item, garage_spot_name: spotNames[item.id] ?? null } : item
  );
}

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

      const [arrivalsRes, departuresRes, settingsRes, statsRes, garageSpotNames] = await Promise.all([
        fetch("/api/rpc/get_todays_arrivals", { method: "POST" }),
        fetch("/api/reservations/departures", { method: "POST" }),
        fetch("/api/settings?key=eq.total_parking_spots"),
        fetch(`/api/stats?period=${activePeriod}`),
        fetchGarageSpotNameMap("/api/garage-assignments"),
      ]);

      if (!arrivalsRes.ok || !departuresRes.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      const arrivals = withGarageSpotName(await arrivalsRes.json(), garageSpotNames);
      const departures = withGarageSpotName(await departuresRes.json(), garageSpotNames);

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

  const handleCheckIn = async (reservationId: string, body: Record<string, unknown>) => {
    setState((prev) => ({ ...prev, isProcessing: true }));
    try {
      const response = await fetch(`/api/driver/reservations/${reservationId}/arrival`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to check-in");
      }
      await fetchDashboardData(period);
    } finally {
      setState((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  const handleCheckOut = async (reservationId: string, body: Record<string, unknown>) => {
    setState((prev) => ({ ...prev, isProcessing: true }));
    try {
      const response = await fetch(`/api/driver/reservations/${reservationId}/departure`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to check-out");
      }
      await fetchDashboardData(period);
    } finally {
      setState((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  const handleCancel = async (reservation: ReservationDto, reason?: string) => {
    setState((prev) => ({ ...prev, isProcessing: true }));
    try {
      const body: { status: "cancelled"; notes?: string } = { status: "cancelled" };
      if (reason) {
        body.notes = reservation.notes
          ? `${reservation.notes}\n\nPowód anulowania: ${reason}`
          : `Powód anulowania: ${reason}`;
      }
      const response = await fetch(`/api/reservations?id=eq.${reservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Failed to cancel reservation");
      await fetchDashboardData(period);
    } finally {
      setState((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  const handleChangeReturnDate = async (reservationId: string, plannedCheckOut: string) => {
    setState((prev) => ({ ...prev, isProcessing: true }));
    try {
      const response = await fetch(`/api/reservations?id=eq.${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planned_check_out: plannedCheckOut }),
      });
      if (!response.ok) throw new Error("Failed to update return date");
      await fetchDashboardData(period);
    } finally {
      setState((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  // TEMPORARY (go-live migration): car already on the lot before ParkTrack.
  const handleCreateLegacyDeparture = async (command: CreateLegacyDepartureCommand) => {
    setState((prev) => ({ ...prev, isProcessing: true }));
    try {
      const response = await fetch("/api/reservations/legacy-departure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Nie udało się dodać wyjazdu");
      }
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
    handleCancel,
    handleChangeReturnDate,
    handleCreateLegacyDeparture,
  };
}
