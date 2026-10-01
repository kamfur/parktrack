import { warsawDateKey } from "@/lib/driver/operating-window";
import type { ReservationDto } from "@/types";
import { isCoveredParkingType, parkingTypeLabel } from "@/lib/pricing/parking-type";

/** Planned timestamp is on a Warsaw calendar day before today. */
export function isOverdue(plannedIso: string, now: Date = new Date()): boolean {
  return warsawDateKey(new Date(plannedIso)) < warsawDateKey(now);
}

/**
 * Driver list search: matches name, license plate or phone. Case-insensitive; spaces and
 * dashes are ignored so "kr12345" finds "KR 12345".
 */
export function matchesDriverSearch(
  r: Pick<ReservationDto, "first_name" | "last_name" | "license_plate" | "phone">,
  query: string
): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[\s-]/g, "");
  const needle = normalize(query);
  if (!needle) return true;
  return [
    r.last_name,
    r.first_name,
    r.license_plate,
    r.phone,
    `${r.first_name ?? ""}${r.last_name}`,
    `${r.last_name}${r.first_name ?? ""}`,
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => normalize(value).includes(needle));
}

/** Planned timestamp is on a Warsaw calendar day after today (shown in the 12h look-ahead). */
export function isAfterToday(plannedIso: string, now: Date = new Date()): boolean {
  return warsawDateKey(new Date(plannedIso)) > warsawDateKey(now);
}

/** Departure within the next 2 hours (airport pickup emphasis). */
export function isNearCheckout(
  plannedCheckoutIso: string,
  now: Date = new Date(),
  windowMs = 2 * 60 * 60 * 1000
): boolean {
  const planned = new Date(plannedCheckoutIso).getTime();
  if (Number.isNaN(planned)) return false;
  const delta = planned - now.getTime();
  return delta >= 0 && delta <= windowMs;
}

export function formatDriverTime(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function driverDisplayName(r: ReservationDto): string {
  return r.first_name ? `${r.first_name} ${r.last_name}` : r.last_name;
}

export function flightDirectionLabel(direction: ReservationDto["flight_direction"]): string | null {
  if (!direction) return null;
  if (direction === "departure") return "Wylot";
  if (direction === "arrival") return "Przylot";
  return direction;
}

/** Garage/carport badge label; null for regular (open_air) reservations or a missing spot name. */
export function garageSpotLabel(
  parkingType: ReservationDto["parking_type"] | null | undefined,
  garageSpotName: string | null | undefined
): string | null {
  if (!isCoveredParkingType(parkingType) || !garageSpotName) return null;
  return `${parkingTypeLabel(parkingType)}: ${garageSpotName}`;
}

/**
 * Amount to collect from the customer, or null when the reservation is already paid
 * (at arrival or earlier) or there is nothing to collect.
 */
export function amountDue(r: Pick<ReservationDto, "is_paid" | "total_cost" | "surcharge_amount">): number | null {
  if (r.is_paid) return null;
  const amount = (r.total_cost ?? 0) + (r.surcharge_amount ?? 0);
  return amount > 0 ? amount : null;
}

/** Stay paid by a travel agency — the driver collects nothing (no payment checkboxes, no surcharge). */
export function isAgencyPaid(r: Pick<ReservationDto, "travel_agency_id">): boolean {
  return r.travel_agency_id != null;
}
