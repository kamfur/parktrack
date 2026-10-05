import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type { DepartureListItem, ReservationDto } from "../../types";
import {
  driverArrivalUpdateSchema,
  driverDepartureUpdateSchema,
  type DriverArrivalUpdate,
  type DriverDepartureUpdate,
} from "../schemas/driver.schema";
import { handledWindowStartIso, pendingWindowEndIso } from "../driver/operating-window";
import { enrichDepartureLists, enrichDepartures } from "./ktw-arrival-hours.service";

export class DriverServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "DriverServiceError";
  }
}

const DRIVER_LIST_SELECT =
  "id, last_name, first_name, phone, email, license_plate, vehicle_count, extra_license_plates, parking_type, planned_check_in, planned_check_out, flight_direction, passenger_count, parking_sector, paid_at_arrival, paid_at_departure, keys_left, surcharge_amount, total_cost, notes, status, is_paid, actual_check_in, actual_check_out, travel_agency_id";

/**
 * Sync rule: is_paid is true when either driver payment flag is true.
 */
export function syncIsPaid(paidAtArrival: boolean, paidAtDeparture: boolean): boolean {
  return paidAtArrival || paidAtDeparture;
}

/**
 * Agency stays are paid by the agency: never write driver payment fields for them
 * (the DB pricing trigger enforces the same; this keeps the request honest).
 */
export function withoutPaymentForAgency<T extends Record<string, unknown>>(
  current: Pick<ReservationDto, "travel_agency_id">,
  updateData: T
): Partial<T> {
  if (current.travel_agency_id == null) return updateData;
  const rest: Partial<T> = { ...updateData };
  delete rest.is_paid;
  delete rest.paid_at_arrival;
  delete rest.paid_at_departure;
  delete rest.surcharge_amount;
  return rest;
}

export class DriverService {
  constructor(private supabase: SupabaseClient<Database>) {}

  async listArrivals(now: Date = new Date()): Promise<ReservationDto[]> {
    const upper = pendingWindowEndIso(now);
    const { data, error } = await this.supabase
      .from("reservations")
      .select(DRIVER_LIST_SELECT)
      .eq("status", "confirmed")
      .lt("planned_check_in", upper)
      .order("planned_check_in", { ascending: true })
      .limit(200);

    if (error) {
      throw new DriverServiceError(`Failed to fetch driver arrivals: ${error.message}`, 500);
    }

    return (data ?? []) as ReservationDto[];
  }

  private async fetchPendingDepartures(now: Date): Promise<ReservationDto[]> {
    const upper = pendingWindowEndIso(now);
    const { data, error } = await this.supabase
      .from("reservations")
      .select(DRIVER_LIST_SELECT)
      .eq("status", "in_progress")
      .lt("planned_check_out", upper)
      .order("planned_check_out", { ascending: true })
      .limit(200);

    if (error) {
      throw new DriverServiceError(`Failed to fetch driver departures: ${error.message}`, 500);
    }

    return (data ?? []) as ReservationDto[];
  }

  async listDepartures(now: Date = new Date()): Promise<DepartureListItem[]> {
    return enrichDepartures(await this.fetchPendingDepartures(now), now);
  }

  async listHandledArrivals(now: Date = new Date()): Promise<ReservationDto[]> {
    const since = handledWindowStartIso(now);
    const { data, error } = await this.supabase
      .from("reservations")
      .select(DRIVER_LIST_SELECT)
      .not("actual_check_in", "is", null)
      .gte("actual_check_in", since)
      .in("status", ["in_progress", "completed"])
      .order("actual_check_in", { ascending: false })
      .limit(200);

    if (error) {
      throw new DriverServiceError(`Failed to fetch handled arrivals: ${error.message}`, 500);
    }

    return (data ?? []) as ReservationDto[];
  }

  private async fetchHandledDepartures(now: Date): Promise<ReservationDto[]> {
    const since = handledWindowStartIso(now);
    const { data, error } = await this.supabase
      .from("reservations")
      .select(DRIVER_LIST_SELECT)
      .not("actual_check_out", "is", null)
      .gte("actual_check_out", since)
      .eq("status", "completed")
      .order("actual_check_out", { ascending: false })
      .limit(200);

    if (error) {
      throw new DriverServiceError(`Failed to fetch handled departures: ${error.message}`, 500);
    }

    return (data ?? []) as ReservationDto[];
  }

  async listHandledDepartures(now: Date = new Date()): Promise<DepartureListItem[]> {
    return enrichDepartures(await this.fetchHandledDepartures(now), now);
  }

  async listDeparturesWithHandled(
    now: Date = new Date()
  ): Promise<{ data: DepartureListItem[]; handled: DepartureListItem[] }> {
    const [pending, handled] = await Promise.all([this.fetchPendingDepartures(now), this.fetchHandledDepartures(now)]);
    return enrichDepartureLists(pending, handled, now);
  }

  async listOccupancy(): Promise<ReservationDto[]> {
    const { data, error } = await this.supabase
      .from("reservations")
      .select(DRIVER_LIST_SELECT)
      .eq("status", "in_progress")
      .order("planned_check_out", { ascending: true })
      .limit(200);

    if (error) {
      throw new DriverServiceError(`Failed to fetch occupancy: ${error.message}`, 500);
    }

    return (data ?? []) as ReservationDto[];
  }

  async confirmArrival(id: string, command: DriverArrivalUpdate): Promise<ReservationDto> {
    const validated = await driverArrivalUpdateSchema.parseAsync(command);
    const current = await this.getById(id);

    if (current.status !== "confirmed") {
      throw new DriverServiceError("Arrival can only be confirmed for reservations with status confirmed", 409);
    }

    const paidAtArrival = validated.paid_at_arrival ?? current.paid_at_arrival;
    const paidAtDeparture = current.paid_at_departure;

    const vehicleCount = validated.vehicle_count ?? current.vehicle_count ?? 1;
    const extraPlates = validated.extra_license_plates ?? current.extra_license_plates ?? [];
    if (extraPlates.length > vehicleCount - 1) {
      throw new DriverServiceError("Za dużo numerów rejestracyjnych w stosunku do liczby aut", 400);
    }

    const updateData = {
      vehicle_count: vehicleCount,
      extra_license_plates: extraPlates,
      status: "in_progress" as const,
      actual_check_in: validated.actual_check_in ?? new Date().toISOString(),
      planned_check_out: validated.planned_check_out ?? current.planned_check_out,
      flight_direction:
        validated.flight_direction === undefined ? current.flight_direction : validated.flight_direction,
      passenger_count: validated.passenger_count === undefined ? current.passenger_count : validated.passenger_count,
      parking_sector: validated.parking_sector === undefined ? current.parking_sector : validated.parking_sector,
      license_plate: validated.license_plate === undefined ? current.license_plate : validated.license_plate,
      keys_left: validated.keys_left ?? current.keys_left ?? false,
      paid_at_arrival: paidAtArrival,
      is_paid: syncIsPaid(paidAtArrival, paidAtDeparture),
    };

    return this.applyUpdate(id, withoutPaymentForAgency(current, updateData));
  }

  async completeDeparture(id: string, command: DriverDepartureUpdate): Promise<ReservationDto> {
    const validated = await driverDepartureUpdateSchema.parseAsync(command);
    const current = await this.getById(id);

    if (current.status !== "in_progress") {
      throw new DriverServiceError("Departure can only be completed for reservations with status in_progress", 409);
    }

    const paidAtArrival = current.paid_at_arrival;
    const paidAtDeparture = validated.paid_at_departure ?? current.paid_at_departure;

    const updateData = {
      status: "completed" as const,
      actual_check_out: validated.actual_check_out ?? new Date().toISOString(),
      planned_check_out: validated.planned_check_out ?? current.planned_check_out,
      notes: validated.notes === undefined ? current.notes : validated.notes,
      paid_at_departure: paidAtDeparture,
      surcharge_amount:
        validated.surcharge_amount === undefined ? current.surcharge_amount : validated.surcharge_amount,
      is_paid: syncIsPaid(paidAtArrival, paidAtDeparture),
    };

    return this.applyUpdate(id, withoutPaymentForAgency(current, updateData));
  }

  /**
   * Price of the stay if it ends at `checkOutIso` — mirrors trg_update_cost, which prices individual
   * stays from the actual arrival (the price list of that day) and reprices unpaid ones when the
   * arrival is recorded. A not-yet-arrived stay is therefore quoted from now. Unchanged date on a
   * stay the trigger would leave alone → stored total_cost.
   */
  async quoteCheckout(id: string, checkOutIso: string, vehicleCountOverride?: number): Promise<number> {
    const current = await this.getById(id);
    const arrivesNow = current.status === "confirmed" && !current.actual_check_in;
    const checkInIso = current.actual_check_in ?? (arrivesNow ? new Date().toISOString() : current.planned_check_in);
    // The count can be corrected only while the arrival is being recorded (RLS blocks it later).
    const vehicleCount = (arrivesNow ? vehicleCountOverride : undefined) ?? current.vehicle_count ?? 1;
    const countChanged = vehicleCount !== (current.vehicle_count ?? 1);

    if (
      Date.parse(checkOutIso) === Date.parse(current.planned_check_out) &&
      !(arrivesNow && !current.is_paid) &&
      !countChanged
    ) {
      return Number(current.total_cost);
    }
    // Validated against the booked date: a client arriving after the planned return is still billed 1 day.
    if (Date.parse(checkOutIso) <= Date.parse(current.planned_check_in)) {
      throw new DriverServiceError("Check-out must be after check-in", 400);
    }

    const { data, error } = await this.supabase.rpc("calculate_total_cost", {
      p_check_in: checkInIso,
      p_check_out: checkOutIso,
      p_parking_type: current.parking_type,
    });

    if (error || data === null || data === undefined) {
      throw new DriverServiceError("Brak cennika dla tego terminu", 422);
    }

    return Number(data) * vehicleCount;
  }

  private async getById(id: string): Promise<ReservationDto> {
    const { data, error } = await this.supabase.from("reservations").select("*").eq("id", id).single();

    if (error || !data) {
      throw new DriverServiceError(`Reservation with ID ${id} not found`, 404);
    }

    return data as ReservationDto;
  }

  private async applyUpdate(id: string, updateData: Record<string, unknown>): Promise<ReservationDto> {
    const { data, error } = await this.supabase.from("reservations").update(updateData).eq("id", id).select().single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new DriverServiceError(`Reservation with ID ${id} not found`, 404);
      }
      throw new DriverServiceError(`Failed to update reservation: ${error.message}`, 500);
    }

    return data as ReservationDto;
  }
}
