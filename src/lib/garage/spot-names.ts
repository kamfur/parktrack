import type { GarageOccupancyEntryDto } from "@/types";

/** reservationId -> assigned garage/carport spot name, for badge display across list views. */
export type GarageSpotNameMap = Record<string, string>;

export function buildGarageSpotNameMap(entries: GarageOccupancyEntryDto[]): GarageSpotNameMap {
  return Object.fromEntries(entries.map((entry) => [entry.reservationId, entry.garageSpotName]));
}

/** Fetches active garage assignments from `url` and builds the lookup map. Fails soft to `{}`. */
export async function fetchGarageSpotNameMap(url: string): Promise<GarageSpotNameMap> {
  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    const entries: GarageOccupancyEntryDto[] = await res.json();
    return buildGarageSpotNameMap(entries);
  } catch {
    return {};
  }
}
