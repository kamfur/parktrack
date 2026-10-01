/** Parking types a reservation can request — also the rows of every price list. */
export const PARKING_TYPES = ["open_air", "carport", "garage"] as const;

export type ParkingType = (typeof PARKING_TYPES)[number];

/** Covered types are served from the garage/carport inventory (`garage_spots.spot_type`). */
export type CoveredParkingType = Exclude<ParkingType, "open_air">;

export const PARKING_TYPE_LABELS: Record<ParkingType, string> = {
  open_air: "Parking",
  carport: "Wiata",
  garage: "Garaż",
};

export function isCoveredParkingType(value: string | null | undefined): value is CoveredParkingType {
  return value === "carport" || value === "garage";
}

export function parkingTypeLabel(value: string | null | undefined): string {
  return value && value in PARKING_TYPE_LABELS
    ? PARKING_TYPE_LABELS[value as ParkingType]
    : PARKING_TYPE_LABELS.open_air;
}
