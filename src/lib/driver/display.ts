import { warsawDateKey } from "@/lib/driver/operating-window";
import type { ReservationDto } from "@/types";

/** Planned timestamp is on a Warsaw calendar day before today. */
export function isOverdue(plannedIso: string, now: Date = new Date()): boolean {
  return warsawDateKey(new Date(plannedIso)) < warsawDateKey(now);
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
  if (parkingType !== "garage" || !garageSpotName) return null;
  return `Garaż: ${garageSpotName}`;
}
