import { z } from "zod";
import { PARKING_TYPES } from "../pricing/parking-type";

export const driverArrivalUpdateSchema = z.object({
  planned_check_out: z.string().datetime("Invalid check-out date format").optional(),
  flight_direction: z.string().max(100).optional().nullable(),
  passenger_count: z.number().int().min(0).max(99).nullable().optional(),
  parking_sector: z.string().max(50).nullable().optional(),
  license_plate: z.string().max(15).nullable().optional(),
  paid_at_arrival: z.boolean().optional(),
  /** Client left the car keys with the parking. */
  keys_left: z.boolean().optional(),
  actual_check_in: z.string().datetime("Invalid actual check-in date format").optional(),
});

export type DriverArrivalUpdate = z.infer<typeof driverArrivalUpdateSchema>;

export const driverDepartureUpdateSchema = z.object({
  notes: z.string().max(1000).nullable().optional(),
  paid_at_departure: z.boolean().optional(),
  surcharge_amount: z.number().nonnegative().nullable().optional(),
  planned_check_out: z.string().datetime("Invalid check-out date format").optional(),
  actual_check_out: z.string().datetime("Invalid actual check-out date format").optional(),
});

export type DriverDepartureUpdate = z.infer<typeof driverDepartureUpdateSchema>;

/**
 * Driver-created reservation. Deliberately narrow: no price, agency or payment fields —
 * the server prices it from the price list (unknown keys are stripped).
 */
export const driverCreateReservationSchema = z
  .object({
    last_name: z.string().trim().min(1, "Nazwisko jest wymagane").max(100),
    first_name: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(20).optional(),
    license_plate: z.string().trim().max(15).optional(),
    flight_direction: z.string().trim().max(100, "Kierunek lotu może mieć maksymalnie 100 znaków").optional(),
    notes: z.string().max(1000).optional(),
    planned_check_in: z.string().datetime("Nieprawidłowa data przyjazdu"),
    planned_check_out: z.string().datetime("Nieprawidłowa data powrotu"),
    parking_type: z.enum(PARKING_TYPES).default("open_air"),
    /** Chosen garage/carport spot; omitted = auto-assign. */
    garage_spot_id: z.string().uuid("Nieprawidłowe miejsce").optional(),
  })
  .refine((data) => Date.parse(data.planned_check_out) > Date.parse(data.planned_check_in), {
    message: "Data powrotu musi być późniejsza niż data przyjazdu",
    path: ["planned_check_out"],
  });

export type DriverCreateReservation = z.infer<typeof driverCreateReservationSchema>;

/**
 * Walk-in arrival: the client arrived without a reservation. The server creates the
 * reservation with check-in = now and confirms the arrival in one request. Same narrow
 * surface as the create + arrival payloads — no price, agency or `is_paid` fields.
 */
export const driverWalkInArrivalSchema = z.object({
  last_name: z.string().trim().min(1, "Nazwisko jest wymagane").max(100),
  first_name: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  license_plate: z.string().trim().max(15).optional(),
  flight_direction: z.string().trim().max(100, "Kierunek lotu może mieć maksymalnie 100 znaków").optional(),
  planned_check_out: z.string().datetime("Podaj planowaną datę wyjazdu"),
  parking_type: z.enum(PARKING_TYPES).default("open_air"),
  /** Chosen garage/carport spot; omitted = auto-assign. Ignored for open-air parking. */
  garage_spot_id: z.string().uuid("Nieprawidłowe miejsce").optional(),
  passenger_count: z.number().int().min(0).max(99).nullable().optional(),
  /** Open-air parking sector. */
  parking_sector: z.string().trim().max(50).optional(),
  paid_at_arrival: z.boolean().default(false),
  keys_left: z.boolean().default(false),
});

export type DriverWalkInArrival = z.infer<typeof driverWalkInArrivalSchema>;
