import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isCoveredParkingType, type ParkingType } from "@/lib/pricing/parking-type";
import type { GarageSpotDto } from "@/types";

/** Radix Select cannot hold "" as an item value — this sentinel stands for "no specific spot". */
const AUTO = "__auto__";

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

interface GarageSpotSelectProps {
  parkingType: ParkingType;
  checkIn: Date | string | null | undefined;
  checkOut: Date | string | null | undefined;
  /** Existing reservation being edited — its current spot stays selectable. */
  reservationId?: string;
  /** Chosen spot id; "" = no specific spot. */
  value: string;
  onChange: (spotId: string) => void;
  /** Label of the "no specific spot" option, e.g. "Automatycznie" or "Bez zmian". */
  emptyLabel: string;
  disabled?: boolean;
  id?: string;
  /**
   * Also offer spots of this type that are busy in the window (marked as such) — editing staff may
   * pick them anyway; the server skips the buffer check for an explicit choice.
   */
  includeOccupied?: boolean;
}

/**
 * Picks a specific garage or carport spot among those free for the stay window
 * (10h buffer kept, checked server-side). Renders nothing for open-air parking.
 */
export function GarageSpotSelect({
  parkingType,
  checkIn,
  checkOut,
  reservationId,
  value,
  onChange,
  emptyLabel,
  disabled,
  id,
  includeOccupied = false,
}: GarageSpotSelectProps) {
  const [spots, setSpots] = useState<GarageSpotDto[]>([]);
  /** Every available spot of the type (only with `includeOccupied`); `spots` holds the free ones. */
  const [allSpots, setAllSpots] = useState<GarageSpotDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  /** True once the list for the current type/window has arrived — until then `value` is kept. */
  const [loaded, setLoaded] = useState(false);

  const covered = isCoveredParkingType(parkingType);
  const checkInIso = toIso(checkIn);
  const checkOutIso = toIso(checkOut);
  const windowValid = !!checkInIso && !!checkOutIso && checkOutIso > checkInIso;

  useEffect(() => {
    setLoaded(false);
    if (!covered || !windowValid) {
      setSpots([]);
      setAllSpots([]);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ type: parkingType, check_in: checkInIso, check_out: checkOutIso });
    if (reservationId) params.set("reservation_id", reservationId);

    setIsLoading(true);
    setLoadError(false);
    const getJson = (url: string): Promise<GarageSpotDto[]> =>
      fetch(url, { signal: controller.signal }).then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(String(res.status)))
      );

    Promise.all([
      getJson(`/api/driver/garage-spots/available?${params}`),
      includeOccupied ? getJson("/api/driver/garage-spots") : Promise.resolve<GarageSpotDto[]>([]),
    ])
      .then(([free, all]) => {
        setSpots(free);
        setAllSpots(all.filter((spot) => spot.spot_type === parkingType && spot.is_available));
        setLoaded(true);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        // eslint-disable-next-line no-console
        console.error("Failed to load available garage spots:", err);
        setSpots([]);
        setAllSpots([]);
        setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [covered, windowValid, parkingType, checkInIso, checkOutIso, reservationId, includeOccupied]);

  // A spot picked for another type or window may no longer be free — fall back to "no specific spot".
  const freeIds = new Set(spots.map((spot) => spot.id));
  const options = includeOccupied ? allSpots : spots;
  useEffect(() => {
    if (value && loaded && !options.some((spot) => spot.id === value)) onChange("");
  }, [value, options, loaded, onChange]);

  if (!covered) return null;

  const noun = parkingType === "garage" ? "garaż" : "wiatę";
  const hint = !windowValid
    ? "Najpierw wybierz daty przyjazdu i wyjazdu."
    : loadError
      ? "Nie udało się pobrać wolnych miejsc — zostanie przydzielone automatycznie."
      : !isLoading && options.length === 0
        ? "Brak wolnych miejsc tego typu w wybranym terminie."
        : null;

  return (
    <div className="space-y-1.5">
      <Select
        value={value || AUTO}
        onValueChange={(next) => onChange(next === AUTO ? "" : next)}
        disabled={disabled || !windowValid || isLoading}
      >
        <SelectTrigger id={id} className="w-full" aria-label={`Wybierz ${noun}`}>
          <SelectValue placeholder={isLoading ? "Wczytywanie…" : emptyLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AUTO}>{emptyLabel}</SelectItem>
          {options.map((spot) => (
            <SelectItem key={spot.id} value={spot.id}>
              {includeOccupied && !freeIds.has(spot.id) ? `${spot.name} (zajęte w tym terminie)` : spot.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
