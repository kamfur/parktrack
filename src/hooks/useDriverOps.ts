import { useCallback, useEffect, useRef, useState } from "react";
import type { DepartureListItem, ReservationDto } from "@/types";
import type { DriverWalkInArrival } from "@/lib/schemas/driver.schema";
import { fetchGarageSpotNameMap, type GarageSpotNameMap } from "@/lib/garage/spot-names";
import { isCoveredParkingType } from "@/lib/pricing/parking-type";

function withGarageSpotName<T extends ReservationDto>(items: T[], spotNames: GarageSpotNameMap): T[] {
  return items.map((item) =>
    isCoveredParkingType(item.parking_type) ? { ...item, garage_spot_name: spotNames[item.id] ?? null } : item
  );
}

type DriverTab = "arrivals" | "departures" | "occupancy";

interface DriverOpsState {
  arrivals: ReservationDto[];
  handledArrivals: ReservationDto[];
  departures: DepartureListItem[];
  handledDepartures: DepartureListItem[];
  occupancy: ReservationDto[];
  isLoading: boolean;
  error: string | null;
  isProcessing: boolean;
  tab: DriverTab;
  /** When the lists were last fetched successfully (shown next to the refresh button). */
  lastUpdated: Date | null;
}

async function readList(res: Response): Promise<ReservationDto[]> {
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  const payload = (await res.json()) as { data?: ReservationDto[] };
  return payload.data ?? [];
}

async function readDriverList<T extends ReservationDto = ReservationDto>(
  res: Response
): Promise<{ pending: T[]; handled: T[] }> {
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  const payload = (await res.json()) as { data?: T[]; handled?: T[] };
  return { pending: payload.data ?? [], handled: payload.handled ?? [] };
}

export function useDriverOps() {
  const [state, setState] = useState<DriverOpsState>({
    arrivals: [],
    handledArrivals: [],
    departures: [],
    handledDepartures: [],
    occupancy: [],
    isLoading: true,
    error: null,
    isProcessing: false,
    tab: "arrivals",
    lastUpdated: null,
  });
  const initialized = useRef(false);
  const fetchGen = useRef(0);

  const refetch = useCallback(async () => {
    const gen = ++fetchGen.current;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const [arrivalsRes, departuresRes, occupancyRes, garageSpotNames] = await Promise.all([
        fetch("/api/driver/arrivals"),
        fetch("/api/driver/departures"),
        fetch("/api/driver/occupancy"),
        fetchGarageSpotNameMap("/api/driver/garage-assignments"),
      ]);
      const [arrivalsList, departuresList, occupancy] = await Promise.all([
        readDriverList(arrivalsRes),
        readDriverList<DepartureListItem>(departuresRes),
        readList(occupancyRes),
      ]);
      if (gen !== fetchGen.current) return;
      setState((prev) => ({
        ...prev,
        arrivals: withGarageSpotName(arrivalsList.pending, garageSpotNames),
        handledArrivals: withGarageSpotName(arrivalsList.handled, garageSpotNames),
        departures: withGarageSpotName(departuresList.pending, garageSpotNames),
        handledDepartures: withGarageSpotName(departuresList.handled, garageSpotNames),
        occupancy: withGarageSpotName(occupancy, garageSpotNames),
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
      }));
    } catch (error) {
      if (gen !== fetchGen.current) return;
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Nie udało się pobrać danych",
      }));
    }
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      void refetch();
    }
    const id = window.setInterval(() => {
      void refetch();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [refetch]);

  const setTab = (tab: DriverTab) => {
    setState((prev) => ({ ...prev, tab }));
  };

  const confirmArrival = async (id: string, body: Record<string, unknown>) => {
    setState((prev) => ({ ...prev, isProcessing: true, error: null }));
    try {
      const res = await fetch(`/api/driver/reservations/${id}/arrival`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Błąd potwierdzenia (${res.status})`);
      }
      await refetch();
    } finally {
      setState((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  const completeDeparture = async (id: string, body: Record<string, unknown>) => {
    setState((prev) => ({ ...prev, isProcessing: true, error: null }));
    try {
      const res = await fetch(`/api/driver/reservations/${id}/departure`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Błąd wyjazdu (${res.status})`);
      }
      await refetch();
    } finally {
      setState((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  const createReservation = async (body: Record<string, unknown>) => {
    setState((prev) => ({ ...prev, isProcessing: true, error: null }));
    try {
      const res = await fetch("/api/driver/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Błąd tworzenia rezerwacji (${res.status})`);
      }
      await refetch();
    } finally {
      setState((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  /** Client arrived without a reservation — create it and confirm the arrival in one call. */
  const createWalkInArrival = async (body: DriverWalkInArrival) => {
    setState((prev) => ({ ...prev, isProcessing: true, error: null }));
    try {
      const res = await fetch("/api/driver/walk-in-arrivals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Błąd dodawania przyjazdu (${res.status})`);
      }
    } finally {
      // Refetch on failure too: the reservation may exist even if the arrival was not confirmed.
      await refetch();
      setState((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  return {
    ...state,
    setTab,
    refetch,
    confirmArrival,
    completeDeparture,
    createReservation,
    createWalkInArrival,
  };
}

export type { DriverTab };
