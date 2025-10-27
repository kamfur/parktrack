import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateExternalReservationCommand } from "../../types";
import { createExternalReservationSchema } from "../schemas/reservation.schema";

export class ReservationService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Creates a new reservation from an external source (e.g. public website).
   * Validates input, checks parking availability, and calculates total cost.
   *
   * @param command - The reservation details from external source
   * @returns The ID of the created reservation
   * @throws Error if parking is full or other business rules are violated
   */
  async createExternalReservation(command: CreateExternalReservationCommand): Promise<string> {
    // Parse and validate input
    const validatedData = await createExternalReservationSchema.parseAsync(command);

    // Check parking availability
    const checkIn = new Date(validatedData.checkInDate);
    const checkOut = new Date(validatedData.checkOutDate);

    const { data: settings } = await this.supabase.from("settings").select("total_parking_spots").single();

    if (!settings) {
      throw new Error("Failed to fetch parking settings");
    }

    // Check occupancy for each day in the range
    const { data: occupancy } = await this.supabase
      .from("daily_occupancy")
      .select("date, occupied_spots")
      .gte("date", checkIn.toISOString().split("T")[0])
      .lte("date", checkOut.toISOString().split("T")[0])
      .order("date");

    if (occupancy) {
      for (const day of occupancy) {
        if (day.occupied_spots >= settings.total_parking_spots) {
          throw new Error(`No available parking spots for date ${day.date}`);
        }
      }
    }

    // Calculate total cost using database function
    const { data: costData } = await this.supabase.rpc("calculate_total_cost", {
      check_in: validatedData.checkInDate,
      check_out: validatedData.checkOutDate,
    });

    if (!costData) {
      throw new Error("Failed to calculate reservation cost");
    }

    // Map command to database schema
    const reservationData = {
      last_name: validatedData.lastName,
      first_name: validatedData.firstName,
      email: validatedData.email,
      phone: validatedData.phone,
      license_plate: validatedData.licensePlate,
      planned_check_in: validatedData.checkInDate,
      planned_check_out: validatedData.checkOutDate,
      source: "api",
      total_cost: costData,
    };

    // Insert reservation
    const { data: reservation, error } = await this.supabase
      .from("reservations")
      .insert(reservationData)
      .select("id")
      .single();

    if (error) {
      throw new Error(`Failed to create reservation: ${error.message}`);
    }

    return reservation.id;
  }
}
