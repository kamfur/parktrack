import { z } from "zod";
import { PARKING_TYPES } from "../pricing/parking-type";
import { MAX_VEHICLE_COUNT } from "../vehicles";

/** Cars in one reservation: whole number 1..MAX_VEHICLE_COUNT (forms always send it). */
const vehicleCountFormSchema = z
  .number({ invalid_type_error: "Podaj liczbę aut" })
  .int("Liczba aut musi być liczbą całkowitą")
  .min(1, "Minimum 1 auto")
  .max(MAX_VEHICLE_COUNT, `Maksymalnie ${MAX_VEHICLE_COUNT} aut`);

/** API payloads may omit it: defaults to a single car. */
const vehicleCountSchema = vehicleCountFormSchema.default(1);

/**
 * Schema for validating external reservation requests.
 * Maps to CreateExternalReservationCommand type.
 */
export const createExternalReservationSchema = z
  .object({
    lastName: z.string().trim().min(1, "Last name is required").max(100, "Last name is too long"),
    firstName: z.string().trim().min(1, "First name is required").max(100, "First name is too long"),
    email: z.string().email("Invalid email address").max(100, "Email is too long"),
    phone: z.string().trim().min(9, "Phone number must be at least 9 characters").max(32, "Phone number is too long"),
    // Optional: website customers often don't know the car yet; the driver enters it on arrival.
    licensePlate: z
      .string()
      .trim()
      .max(32, "License plate is too long")
      .optional()
      .transform((value) => value || undefined),
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
    flight_direction: z.string().max(100, "Flight direction must be at most 100 characters").optional(),
    parking_type: z.enum(PARKING_TYPES).default("open_air"),
    /** Chosen garage/carport spot (covered types only); omitted = auto-assign the first free one. */
    garage_spot_id: z.string().uuid("Invalid garage spot ID").optional(),
    /** Paying travel agency; the DB then prices with its discount and marks the stay paid. */
    travel_agency_id: z.string().uuid("Invalid travel agency ID").nullable().optional(),
    /** Cars covered by the reservation; the price is multiplied by it. */
    vehicle_count: vehicleCountSchema,
    /** Plates of cars 2..vehicle_count (car 1 is license_plate). */
    extra_license_plates: z
      .array(z.string().trim().max(15))
      .max(MAX_VEHICLE_COUNT - 1)
      .optional(),
  })
  .refine((data) => (data.extra_license_plates?.length ?? 0) <= data.vehicle_count - 1, {
    message: "Too many license plates for the vehicle count",
    path: ["extra_license_plates"],
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
  flight_direction: z.string().max(100, "Flight direction must be at most 100 characters").optional().nullable(),
  status: z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"]).optional(),
  actual_check_in: z.string().datetime("Invalid actual check-in date format").optional(),
  actual_check_out: z.string().datetime("Invalid actual check-out date format").optional(),
  passenger_count: z.number().int().min(0).max(99).nullable().optional(),
  parking_sector: z.string().max(50).nullable().optional(),
  paid_at_arrival: z.boolean().optional(),
  paid_at_departure: z.boolean().optional(),
  surcharge_amount: z.number().nonnegative().nullable().optional(),
  is_paid: z.boolean().optional(),
  parking_type: z.enum(PARKING_TYPES).optional(),
  /** Move to this garage/carport spot (not a reservations column — handled via garage_assignments). */
  garage_spot_id: z.string().uuid("Invalid garage spot ID").optional(),
  /** Client left the car keys — editable only while the car is on the parking (in_progress). */
  keys_left: z.boolean().optional(),
  travel_agency_id: z.string().uuid("Invalid travel agency ID").nullable().optional(),
  vehicle_count: vehicleCountFormSchema.optional(),
  extra_license_plates: z
    .array(z.string().trim().max(15))
    .max(MAX_VEHICLE_COUNT - 1)
    .optional(),
});

export type UpdateReservationSchema = typeof updateReservationSchema;

export const changeReturnDateFormSchema = z.object({
  planned_check_out: z.string().min(1, "Podaj datę i godzinę powrotu"),
});

export type ChangeReturnDateFormData = z.infer<typeof changeReturnDateFormSchema>;

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
export type QuickReservationFormData = z.infer<typeof quickReservationSchema>;

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
      .refine(
        (value) => {
          const digits = value.replace(/\D/g, "");
          return digits.length === 0 || digits.length === 9;
        },
        { message: "Numer telefonu musi zawierać 9 cyfr" }
      )
      .optional()
      .or(z.literal("")),
    licensePlate: z.string().max(15, "Numer rejestracyjny jest zbyt długi").optional().or(z.literal("")),
    /** Liczba aut w rezerwacji (cena × liczba aut) */
    vehicleCount: vehicleCountFormSchema,
    flightDirection: z
      .string()
      .max(100, "Kierunek lotu może zawierać maksymalnie 100 znaków")
      .optional()
      .or(z.literal("")),
    notes: z.string().max(1000, "Notatki mogą zawierać maksymalnie 1000 znaków").optional(),
    parkingType: z.enum(PARKING_TYPES).optional(),
    /** "" = przydział automatyczny (tylko wiata/garaż) */
    garageSpotId: z.string().uuid("Nieprawidłowe miejsce").optional().or(z.literal("")),
    /** "" = brak biura (klient indywidualny) */
    travelAgencyId: z.string().uuid("Nieprawidłowe biuro podróży").optional().or(z.literal("")),
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
export type FullReservationFormData = z.infer<typeof fullReservationSchema>;

/**
 * Schemat walidacji edycji istniejącej rezerwacji.
 * Bez reguły „data przyjazdu nie może być w przeszłości” — rezerwacje często
 * mają daty wsteczne, a personel musi móc poprawić pozostałe pola.
 */
export const editReservationSchema = z
  .object({
    lastName: baseReservationFields.lastName,
    firstName: z
      .string()
      .max(100, "Imię może zawierać maksymalnie 100 znaków")
      .regex(/^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s]*$/, "Imię może zawierać tylko litery i spacje")
      .optional()
      .or(z.literal("")),
    email: z
      .string()
      .email("Nieprawidłowy format email")
      .max(255, "Email może zawierać maksymalnie 255 znaków")
      .optional()
      .or(z.literal("")),
    phone: z.string().max(20, "Numer telefonu jest zbyt długi").optional().or(z.literal("")),
    licensePlate: z.string().max(15, "Numer rejestracyjny jest zbyt długi").optional().or(z.literal("")),
    vehicleCount: vehicleCountFormSchema,
    /** Numery aut 2..N (auto 1 = licensePlate); jeden wpis na auto, puste dozwolone */
    extraLicensePlates: z.array(z.string().max(15, "Numer rejestracyjny jest zbyt długi")),
    checkInDate: baseReservationFields.checkInDate,
    checkOutDate: baseReservationFields.checkOutDate,
    flightDirection: z
      .string()
      .max(100, "Kierunek lotu może zawierać maksymalnie 100 znaków")
      .optional()
      .or(z.literal("")),
    notes: z.string().max(1000, "Notatki mogą zawierać maksymalnie 1000 znaków").optional().or(z.literal("")),
    /** "" = brak biura (klient indywidualny) */
    travelAgencyId: z.string().uuid("Nieprawidłowe biuro podróży").optional().or(z.literal("")),
    parkingType: z.enum(PARKING_TYPES),
    /** "" = bez zmian (lub przydział automatyczny przy zmianie typu) */
    garageSpotId: z.string().uuid("Nieprawidłowe miejsce").optional().or(z.literal("")),
    keysLeft: z.boolean(),
    /** Opłacono przy przyjeździe / wyjeździe (nie dotyczy rezerwacji biura podróży) */
    paidAtArrival: z.boolean().optional(),
    paidAtDeparture: z.boolean().optional(),
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
  );

export type EditReservationSchema = typeof editReservationSchema;
export type EditReservationFormData = z.infer<typeof editReservationSchema>;

/**
 * TEMPORARY (go-live migration): register a car that was already parked before
 * ParkTrack went live, so its return shows up on the departures list.
 * The arrival date is irrelevant here — the server sets `planned_check_in`/`actual_check_in`
 * to the moment of registration and creates the reservation directly as `in_progress`.
 * Remove together with `/api/reservations/legacy-departure` once migration is done.
 */
export const createLegacyDepartureSchema = z
  .object({
    last_name: z.string().trim().min(1, "Nazwisko jest wymagane").max(100),
    first_name: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(20).optional(),
    license_plate: z.string().trim().max(15).optional(),
    notes: z.string().max(1000).optional(),
    flight_direction: z.string().trim().max(100, "Kierunek lotu może mieć maksymalnie 100 znaków").optional(),
    parking_sector: z.string().trim().max(50, "Sektor może mieć maksymalnie 50 znaków").optional(),
    passenger_count: z.number().int().min(0).max(99, "Maksymalnie 99 pasażerów").optional(),
    planned_check_out: z.string().datetime("Nieprawidłowa data powrotu"),
    total_cost: z.number().positive("Kwota musi być dodatnia").optional(),
    /** Rule: pre-go-live stays count as paid unless staff explicitly marks them unpaid. */
    unpaid: z.boolean().default(false),
  })
  // Arrival is "now", so the return must be in the future.
  .refine((data) => Date.parse(data.planned_check_out) > Date.now(), {
    message: "Data powrotu musi być w przyszłości",
    path: ["planned_check_out"],
  });

export type CreateLegacyDepartureCommand = z.infer<typeof createLegacyDepartureSchema>;
