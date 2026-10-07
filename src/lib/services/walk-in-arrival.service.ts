import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type { ReservationDto } from "../../types";
import { driverWalkInArrivalSchema, type DriverWalkInArrival } from "../schemas/driver.schema";
import { DriverService, DriverServiceError } from "./driver.service";
import { ReservationService } from "./reservation.service";

/**
 * Walk-in arrival (client came without a reservation): create the reservation with
 * check-in = now, then confirm the arrival through the same path as a booked arrival —
 * so pricing, garage allocation and payment rules stay identical to the two-step flow.
 *
 * Not atomic: if the confirmation fails, the reservation stays `confirmed` and shows up
 * in the arrivals list, where the driver can accept it the normal way.
 */
export async function createWalkInArrival(
  supabase: SupabaseClient<Database>,
  command: DriverWalkInArrival,
  userId: string,
  now: Date = new Date()
): Promise<ReservationDto> {
  const data = await driverWalkInArrivalSchema.parseAsync(command);
  const nowIso = now.toISOString();

  if (Date.parse(data.planned_check_out) <= now.getTime()) {
    throw new DriverServiceError("Planowany wyjazd musi być późniejszy niż teraz", 400);
  }

  const created = await new ReservationService(supabase).createReservation(
    {
      last_name: data.last_name,
      first_name: data.first_name,
      phone: data.phone,
      license_plate: data.license_plate,
      vehicle_count: data.vehicle_count,
      extra_license_plates: data.extra_license_plates,
      flight_direction: data.flight_direction,
      planned_check_in: nowIso,
      planned_check_out: data.planned_check_out,
      parking_type: data.parking_type,
      garage_spot_id: data.parking_type === "open_air" ? undefined : data.garage_spot_id,
      source: "walk_in",
    },
    userId
  );

  try {
    return await new DriverService(supabase).confirmArrival(created.id, {
      actual_check_in: nowIso,
      passenger_count: data.passenger_count ?? null,
      parking_sector: data.parking_type === "open_air" ? data.parking_sector || null : null,
      paid_at_arrival: data.paid_at_arrival,
      keys_left: data.keys_left,
    });
  } catch (error) {
    console.error("Walk-in reservation created but arrival not confirmed:", error);
    throw new DriverServiceError(
      "Rezerwacja została utworzona, ale nie udało się potwierdzić przyjazdu — przyjmij ją z listy przyjazdów",
      500
    );
  }
}
