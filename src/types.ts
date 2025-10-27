import type { Tables, TablesInsert, TablesUpdate } from "./db/database.types";

// ############################################################################
//
// ENTITIES
//
// ############################################################################

/**
 * Represents the shape of a reservation record in the database.
 * This type is derived directly from the auto-generated Supabase types.
 */
export type Reservation = Tables<"reservations">;

// ############################################################################
//
// DATA TRANSFER OBJECTS (DTOs)
//
// ############################################################################

/**
 * Data Transfer Object for a reservation, used for API responses.
 * It directly maps to the `Reservation` entity.
 */
export type ReservationDto = Reservation;

/**
 * DTO for the successful creation of a reservation via the external API.
 */
export interface CreateExternalReservationResponseDto {
  reservationId: string;
  message: string;
}

// ############################################################################
//
// COMMAND MODELS
//
// ############################################################################

/**
 * Command model for creating a new reservation through internal endpoints.
 * It selects a subset of fields from the database insert type that are
 * expected from the client, as other fields like `created_by` are set server-side.
 */
export type CreateReservationCommand = Pick<
  TablesInsert<"reservations">,
  | "last_name"
  | "planned_check_in"
  | "planned_check_out"
  | "source"
  | "total_cost"
  | "email"
  | "first_name"
  | "phone"
  | "flight_direction"
  | "license_plate"
  | "notes"
>;

/**
 * Command model for updating an existing reservation.
 * It uses the auto-generated `TablesUpdate` type, where all fields are optional,
 * allowing for partial updates.
 */
export type UpdateReservationCommand = TablesUpdate<"reservations">;
/**
 * Command model for creating a reservation from an external source (e.g., public website).
 * Note the use of camelCase to match the external API's contract.
 * The backend service is responsible for mapping this to the snake_case database schema.
 */
export interface CreateExternalReservationCommand {
  lastName: string;
  firstName: string;
  email: string;
  phone: string;
  licensePlate: string;
  checkInDate: string;
  checkOutDate: string;
}
