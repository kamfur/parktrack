/** Max cars one reservation can cover (mirrors reservations_vehicle_count_range in the DB). */
export const MAX_VEHICLE_COUNT = 10;

interface PlatesSource {
  license_plate?: string | null;
  extra_license_plates?: string[] | null;
  vehicle_count?: number | null;
}

/** Plates of all cars in the reservation, car 1 first; empty entries are dropped. */
export function allLicensePlates(source: PlatesSource): string[] {
  return [source.license_plate, ...(source.extra_license_plates ?? [])]
    .map((plate) => plate?.trim() ?? "")
    .filter((plate) => plate.length > 0);
}

/** Plates as one display string, e.g. "WA 12345 · KR 99999". */
export function joinLicensePlates(source: PlatesSource, separator = " · "): string {
  return allLicensePlates(source).join(separator);
}

/** Splits a per-car plate list into the DB shape: car 1 → license_plate, the rest → extras. */
export function splitLicensePlates(
  plates: string[],
  vehicleCount: number
): {
  license_plate: string | null;
  extra_license_plates: string[];
} {
  const normalized = plates.slice(0, vehicleCount).map((plate) => plate.trim().toUpperCase());
  const extras = normalized.slice(1);
  // Trim trailing blanks only, so a gap (car 2 unknown, car 3 known) keeps the positions.
  while (extras.length > 0 && extras[extras.length - 1] === "") extras.pop();
  return { license_plate: normalized[0] || null, extra_license_plates: extras };
}

/** Per-car plate inputs for a form: exactly `vehicleCount` entries, padded with "". */
export function platesForInputs(source: PlatesSource, vehicleCount: number): string[] {
  const all = [source.license_plate ?? "", ...(source.extra_license_plates ?? [])];
  return Array.from({ length: vehicleCount }, (_, i) => all[i] ?? "");
}
