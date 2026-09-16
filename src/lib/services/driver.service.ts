import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type { DepartureListItem, ReservationDto } from "../../types";
import {
  driverArrivalUpdateSchema,
  driverDepartureUpdateSchema,
  type DriverArrivalUpdate,
  type DriverDepartureUpdate,
} from "../schemas/driver.schema";
import { handledWindowStartIso, startOfTomorrowWarsawIso } from "../driver/operating-window";
import { enrichDepartures } from "./ktw-arrival-hours.service";

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
  "id, last_name, first_name, license_plate, planned_check_in, planned_check_out, flight_direction, passenger_count, parking_sector, paid_at_arrival, paid_at_departure, surcharge_amount, notes, status, is_paid, actual_check_in, actual_check_out";

/**
 * Sync rule: is_paid is true when either driver payment flag is true.
 */
export function syncIsPaid(paidAtArrival: boolean, paidAtDeparture: boolean): boolean {
  return paidAtArrival || paidAtDeparture;
}

export class DriverService {
  constructor(private supabase: SupabaseClient<Database>) {}

  async listArrivals(now: Date = new Date()): Promise<ReservationDto[]> {
    const upper = startOfTomorrowWarsawIso(now);
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

  async listDepartures(now: Date = new Date()): Promise<DepartureListItem[]> {
    const upper = startOfTomorrowWarsawIso(now);
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

    return enrichDepartures((data ?? []) as ReservationDto[], now);
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

  async listHandledDepartures(now: Date = new Date()): Promise<DepartureListItem[]> {
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

    return enrichDepartures((data ?? []) as ReservationDto[], now);
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

    const updateData = {
      status: "in_progress" as const,
      actual_check_in: validated.actual_check_in ?? new Date().toISOString(),
      planned_check_out: validated.planned_check_out ?? current.planned_check_out,
      flight_direction:
        validated.flight_direction === undefined ? current.flight_direction : validated.flight_direction,
      passenger_count: validated.passenger_count === undefined ? current.passenger_count : validated.passenger_count,
      parking_sector: validated.parking_sector === undefined ? current.parking_sector : validated.parking_sector,
      paid_at_arrival: paidAtArrival,
      is_paid: syncIsPaid(paidAtArrival, paidAtDeparture),
    };

    return this.applyUpdate(id, updateData);
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

    return this.applyUpdate(id, updateData);
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
