import { fromWarsawDateTimeLocal, warsawDateKey, warsawDayBounds } from "../calendar/warsaw-time";
import type { ParkCloudBooking } from "./parkcloud.port";

export const PARKVIA_SOURCE = "parkvia";

/** Booking fields ParkVia owns; re-applied on every AMEND while the stay has not started. */
export interface ParkViaReservationFields {
  last_name: string;
  first_name: string | null;
  email: string | null;
  phone: string | null;
  license_plate: string | null;
  planned_check_in: string;
  planned_check_out: string;
  passenger_count: number | null;
  flight_direction: string | null;
  total_cost: number;
}

/** Local reservation state the sync decision depends on. */
export interface ExistingReservation {
  id: string;
  status: string;
  last_name: string;
  first_name: string | null;
  email: string | null;
  phone: string | null;
  license_plate: string | null;
  planned_check_in: string;
  planned_check_out: string;
  passenger_count: number | null;
  flight_direction: string | null;
  total_cost: number;
}

export type SyncAction =
  | { kind: "insert"; fields: ParkViaReservationFields; notes: string }
  | { kind: "update"; id: string; changes: Partial<ParkViaReservationFields> }
  | { kind: "status"; id: string; status: "cancelled" | "no_show" }
  | { kind: "skip"; reason: string };

/** "2026-10-11T03:15:00" (Warsaw wall clock, no offset) → UTC ISO. */
export function parkCloudLocalToIso(value: string): string {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!match) throw new Error(`Unexpected ParkCloud date: ${value}`);
  return fromWarsawDateTimeLocal(`${match[1]}T${match[2]}:${match[3]}`);
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function mapBookingFields(booking: ParkCloudBooking): ParkViaReservationFields {
  const lead = booking.PassengerNames?.find((p) => p.Lead) ?? booking.PassengerNames?.[0];
  const passengers = (booking.Passengers ?? 0) + (booking.PassengersChild ?? 0) + (booking.PassengersInfant ?? 0);
  const plate = clean(booking.Vehicle?.Registration);

  return {
    last_name: clean(booking.Customer?.Surname) ?? clean(lead?.Surname) ?? `ParkVia ${booking.Reference}`,
    first_name: clean(booking.Customer?.FirstName) ?? clean(lead?.FirstName),
    email: clean(booking.Customer?.Email),
    phone: clean(booking.Customer?.Mobile),
    license_plate: plate ? plate.toUpperCase() : null,
    planned_check_in: parkCloudLocalToIso(booking.ArrivalDate),
    planned_check_out: parkCloudLocalToIso(booking.DepartureDate),
    passenger_count: passengers > 0 ? passengers : null,
    flight_direction: clean(booking.ReturningFrom),
    total_cost: Math.round(((booking.AmountPaid ?? 0) + (booking.AmountDue ?? 0)) * 100) / 100,
  };
}

/** Notes written once on import; staff may edit them afterwards, so AMENDs never overwrite them. */
export function buildImportNotes(booking: ParkCloudBooking): string {
  const vehicle = [booking.Vehicle?.Make, booking.Vehicle?.Model, booking.Vehicle?.Colour]
    .map(clean)
    .filter(Boolean)
    .join(" ");
  const extras = (booking.Options ?? [])
    .filter((o) => clean(o.Description) && clean(o.Description)?.toLowerCase() !== "parking")
    .map((o) => `${o.Quantity ?? 1}× ${clean(o.Description)}`);
  const outbound = [clean(booking.OutboundFlight), clean(booking.OutboundTerminal)].filter(Boolean).join(", ");
  const inbound = [clean(booking.ReturnFlight), clean(booking.ReturnTerminal)].filter(Boolean).join(", ");

  const lines = [
    `ParkVia: ${booking.Reference}`,
    booking.Currency && booking.Currency !== "PLN" ? `Waluta ParkVia: ${booking.Currency}` : null,
    vehicle ? `Pojazd: ${vehicle}` : null,
    outbound ? `Wylot: ${outbound}` : null,
    inbound ? `Powrót: ${inbound}` : null,
    extras.length ? `Opcje: ${extras.join(", ")}` : null,
    clean(booking.SpecialRequests) ? `Uwagi klienta: ${clean(booking.SpecialRequests)}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

function changedFields(
  current: ExistingReservation,
  next: ParkViaReservationFields
): Partial<ParkViaReservationFields> {
  const changes: Partial<ParkViaReservationFields> = {};
  for (const key of Object.keys(next) as (keyof ParkViaReservationFields)[]) {
    const before = current[key];
    const after = next[key];
    const same =
      key === "planned_check_in" || key === "planned_check_out"
        ? Date.parse(String(before)) === Date.parse(String(after))
        : key === "total_cost"
          ? Number(before) === Number(after)
          : (before ?? null) === (after ?? null);
    if (!same) (changes as Record<string, unknown>)[key] = after;
  }
  return changes;
}

/**
 * What to do with one ParkVia booking given the local reservation (if already imported).
 * Only stays that have not started are touched — once the driver took the car, ParkTrack owns it,
 * and a stay staff cancelled / marked no-show locally is not resurrected.
 */
export function decideSyncAction(
  booking: ParkCloudBooking,
  existing: ExistingReservation | null,
  now: Date = new Date()
): SyncAction {
  const status = booking.Status.toUpperCase();

  if (!existing) {
    if (status !== "CONFIRMED") return { kind: "skip", reason: `not imported, status ${status}` };
    if (booking.IsNoShow) return { kind: "skip", reason: "not imported, already a no-show" };
    const fields = mapBookingFields(booking);
    // Finished stays are not wanted in ParkTrack (and stay deleted when an old booking gets an event).
    if (Date.parse(fields.planned_check_out) < Date.parse(warsawDayBounds(warsawDateKey(now)).start)) {
      return { kind: "skip", reason: "not imported, departure before today" };
    }
    return { kind: "insert", fields, notes: buildImportNotes(booking) };
  }

  if (existing.status !== "confirmed") {
    return { kind: "skip", reason: `local status ${existing.status}` };
  }
  if (status === "CANCELLED") return { kind: "status", id: existing.id, status: "cancelled" };
  if (booking.IsNoShow) return { kind: "status", id: existing.id, status: "no_show" };
  if (status !== "CONFIRMED") return { kind: "skip", reason: `status ${status}` };

  const changes = changedFields(existing, mapBookingFields(booking));
  return Object.keys(changes).length
    ? { kind: "update", id: existing.id, changes }
    : { kind: "skip", reason: "unchanged" };
}
