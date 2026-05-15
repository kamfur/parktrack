import { z } from "zod";

/**
 * Schema for validating external reservation requests.
 * Maps to CreateExternalReservationCommand type.
 */
export const createExternalReservationSchema = z
  .object({
    lastName: z.string().min(1, "Last name is required"),
    firstName: z.string().min(1, "First name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().min(9, "Phone number must be at least 9 characters"),
    licensePlate: z.string().min(1, "License plate is required"),
    checkInDate: z.string().datetime("Invalid check-in date format"),
    checkOutDate: z.string().datetime("Invalid check-out date format"),
  })
  .refine(
    (data) => {
      const checkIn = new Date(data.checkInDate);
      const checkOut = new Date(data.checkOutDate);
      return checkOut > checkIn;
    },
    {
      message: "Check-out date must be after check-in date",
      path: ["checkOutDate"],
    }
  );

export type CreateExternalReservationSchema = typeof createExternalReservationSchema;

/**
 * Schema for validating internal reservation creation requests.
 * Maps to CreateReservationCommand type.
 * Used for staff-created reservations through internal API endpoints.
 */
export const createReservationSchema = z
  .object({
    last_name: z.string().min(1, "Last name is required"),
    planned_check_in: z.string().datetime("Invalid check-in date format"),
    planned_check_out: z.string().datetime("Invalid check-out date format"),
    source: z.enum(["phone", "walk_in", "api"], {
      errorMap: () => ({ message: "Source must be one of: phone, walk_in, api" }),
    }),
    total_cost: z.number().positive("Total cost must be a positive number").optional(),
    first_name: z.string().optional(),
    email: z.string().email("Invalid email address").optional().or(z.literal("")),
    phone: z.string().optional(),
    license_plate: z.string().optional(),
    notes: z.string().optional(),
    flight_direction: z.enum(["departure", "arrival"]).optional(),
  })
  .refine(
    (data) => {
      const checkIn = new Date(data.planned_check_in);
      const checkOut = new Date(data.planned_check_out);
      return checkOut > checkIn;
    },
    {
      message: "Planned check-out date must be after planned check-in date",
      path: ["planned_check_out"],
    }
  );

export type CreateReservationSchema = typeof createReservationSchema;

/**
 * Schema for validating reservation update requests.
 * Maps to UpdateReservationCommand type.
 * Allows partial updates of reservation fields.
 * Note: Uses the base object schema without refinements to allow partial updates.
 */
export const updateReservationSchema = z.object({
  last_name: z.string().min(1, "Last name is required").optional(),
  planned_check_in: z.string().datetime("Invalid check-in date format").optional(),
  planned_check_out: z.string().datetime("Invalid check-out date format").optional(),
  source: z
    .enum(["phone", "walk_in", "api"], {
      errorMap: () => ({ message: "Source must be one of: phone, walk_in, api" }),
    })
    .optional(),
  total_cost: z.number().positive("Total cost must be a positive number").optional(),
  first_name: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")).optional(),
  phone: z.string().optional(),
  license_plate: z.string().optional(),
  notes: z.string().optional(),
  flight_direction: z.enum(["departure", "arrival"]).optional(),
  status: z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled"]).optional(),
  actual_check_in: z.string().datetime("Invalid actual check-in date format").optional(),
  actual_check_out: z.string().datetime("Invalid actual check-out date format").optional(),
});

export type UpdateReservationSchema = typeof updateReservationSchema;

/**
 * Bazowe pola formularza (używane w Quick i Full Mode)
 */
const baseReservationFields = {
  lastName: z
    .string()
    .min(2, "Nazwisko musi zawierać minimum 2 znaki")
    .max(100, "Nazwisko może zawierać maksymalnie 100 znaków")
    .regex(/^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]+$/, "Nazwisko może zawierać tylko litery, spacje i myślniki"),
  checkInDate: z.date({
    required_error: "Data przyjazdu jest wymagana",
    invalid_type_error: "Nieprawidłowy format daty",
  }),
  checkOutDate: z.date({
    required_error: "Data wyjazdu jest wymagana",
    invalid_type_error: "Nieprawidłowy format daty",
  }),
};

/**
 * Schemat walidacji dla Quick Mode
 */
export const quickReservationSchema = z
  .object(baseReservationFields)
  .refine(
    (data) => {
      if (!data.checkInDate || !data.checkOutDate) return false;
      return data.checkOutDate > data.checkInDate;
    },
    {
      message: "Data wyjazdu musi być późniejsza niż data przyjazdu",
      path: ["checkOutDate"],
    }
  )
  .refine(
    (data) => {
      if (!data.checkInDate) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return data.checkInDate >= today;
    },
    {
      message: "Data przyjazdu nie może być w przeszłości",
      path: ["checkInDate"],
    }
  );

export type QuickReservationSchema = typeof quickReservationSchema;

/**
 * Schemat walidacji dla Full Mode
 */
export const fullReservationSchema = z
  .object({
    ...baseReservationFields,
    firstName: z
      .string()
      .max(100, "Imię może zawierać maksymalnie 100 znaków")
      .regex(/^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s]*$/, "Imię może zawierać tylko litery i spacje")
      .optional(),
    email: z
      .string()
      .email("Nieprawidłowy format email")
      .max(255, "Email może zawierać maksymalnie 255 znaków")
      .optional()
      .or(z.literal("")),
    phone: z
      .string()
      .regex(/^\d{9}$/, "Numer telefonu musi zawierać 9 cyfr")
      .optional()
      .or(z.literal("")),
    licensePlate: z
      .string()
      .regex(/^[A-Z]{2}\s?[A-Z0-9]{4,5}$/, "Nieprawidłowy format numeru rejestracyjnego")
      .optional()
      .or(z.literal("")),
    flightDirection: z.enum(["departure", "arrival"]).nullable().optional(),
    notes: z.string().max(1000, "Notatki mogą zawierać maksymalnie 1000 znaków").optional(),
  })
  .refine(
    (data) => {
      if (!data.checkInDate || !data.checkOutDate) return false;
      return data.checkOutDate > data.checkInDate;
    },
    {
      message: "Data wyjazdu musi być późniejsza niż data przyjazdu",
      path: ["checkOutDate"],
    }
  )
  .refine(
    (data) => {
      if (!data.checkInDate) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return data.checkInDate >= today;
    },
    {
      message: "Data przyjazdu nie może być w przeszłości",
      path: ["checkInDate"],
    }
  );

export type FullReservationSchema = typeof fullReservationSchema;
